import "server-only";
import { ai, z } from "@/genkit/index";
import { perceive } from "@/genkit/steps/perceive";
import { getDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// The intake pipeline (data-shapes §13). C3 implements Perceive; Locate/Dedup/Route/
// Act land in C4–C6. Persists via Admin (reports update is server-only in the rules).
// Idempotent: safe to re-run — only acts while perceive is still pending.
const TERMINAL = ["rejected", "needs_review", "seeded", "linked"];

// Firestore rejects serverTimestamp() inside array elements → use Timestamp.now()
// for the embedded StepTrace times; serverTimestamp() is fine for the top-level field.
function stripUndefined<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export const intakeFlow = ai.defineFlow(
  {
    name: "intakeFlow",
    inputSchema: z.object({ reportId: z.string() }),
    outputSchema: z.object({
      status: z.string(),
      serviceCode: z.string().optional(),
    }),
  },
  async ({ reportId }) => {
    const ref = getDb().collection("reports").doc(reportId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("NOT_FOUND");

    type Step = {
      step: string;
      status: string;
      summary: string;
      latencyMs?: number;
      startedAt?: unknown;
      finishedAt?: unknown;
      error?: string;
    };
    const report = snap.data() as {
      status: string;
      media: { path: string };
      rawText?: string;
      pipeline: Step[];
    };
    const pipeline = [...(report.pipeline ?? [])];
    const i = pipeline.findIndex((s) => s.step === "perceive");
    if (i < 0) throw new Error("NO_PERCEIVE_STEP");

    // Idempotency guard: skip if already analysed or the report is terminal.
    if (pipeline[i].status === "done" || TERMINAL.includes(report.status)) {
      return { status: report.status };
    }

    // Mark perceive running (live in the citizen's trace via onSnapshot).
    pipeline[i] = { ...pipeline[i], status: "running", startedAt: Timestamp.now() };
    await ref.update({ pipeline, updatedAt: FieldValue.serverTimestamp() });

    const t0 = Date.now();
    const analysis = await ai.run("perceive", () =>
      perceive({ mediaPath: report.media.path, rawText: report.rawText }),
    );
    const latencyMs = Date.now() - t0;
    const finishedAt = Timestamp.now();

    // Model couldn't conform after retries → needs_review (never silently drop).
    if (!analysis) {
      pipeline[i] = {
        ...pipeline[i],
        status: "error",
        summary: "Couldn’t analyse the photo",
        latencyMs,
        finishedAt,
        error: "null_output",
      };
      await ref.update({ pipeline, status: "needs_review", updatedAt: FieldValue.serverTimestamp() });
      return { status: "needs_review" };
    }

    // Not a civic issue (or low confidence) → rejected, with a friendly UI state.
    if (!analysis.isCivicIssue || analysis.confidence < 0.5) {
      pipeline[i] = {
        ...pipeline[i],
        status: "done",
        summary: "Not a civic issue",
        latencyMs,
        finishedAt,
      };
      await ref.update({
        analysis: stripUndefined(analysis),
        pipeline,
        status: "rejected",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: "rejected", serviceCode: analysis.serviceCode };
    }

    // Classified. Stays 'processing' — Locate/Dedup/Route/Act continue in C4–C6.
    pipeline[i] = {
      ...pipeline[i],
      status: "done",
      summary: `${analysis.serviceName} · ${analysis.severity}`,
      latencyMs,
      finishedAt,
    };
    await ref.update({
      analysis: stripUndefined(analysis),
      pipeline,
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { status: "processing", serviceCode: analysis.serviceCode };
  },
);

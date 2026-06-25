import "server-only";
import { ai, z } from "@/genkit/index";
import { perceive } from "@/genkit/steps/perceive";
import { locate } from "@/genkit/steps/locate";
import { getDb } from "@/lib/firebase-admin";
import { trackingId } from "@/lib/trackingId";
import { geohashOf } from "@/lib/geo";
import type { PerceiveOutput } from "@/genkit/schemas";
import { FieldValue, Timestamp, type GeoPoint } from "firebase-admin/firestore";

// The intake pipeline (data-shapes §13). C3 = Perceive; C4 = Locate + seed issue +
// start SLA. Persists via Admin (reports/issues writes are server-only in the rules).
// Two independent idempotent phases so a re-kick resumes correctly: perceive runs iff
// not yet done; locate+create runs iff classified-civic and not yet issued.
const TERMINAL = ["rejected", "needs_review", "seeded", "linked"];
const stripUndefined = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

type Step = {
  step: string;
  status: string;
  summary: string;
  latencyMs?: number;
  startedAt?: unknown;
  finishedAt?: unknown;
  error?: string;
};
type ReportShape = {
  reporterUid: string;
  status: string;
  media: { path: string; downloadUrl: string; contentType: string; sizeBytes: number };
  rawText?: string;
  location: GeoPoint;
  geohash?: string;
  analysis?: PerceiveOutput;
  issueId?: string;
  pipeline: Step[];
};

export const intakeFlow = ai.defineFlow(
  {
    name: "intakeFlow",
    inputSchema: z.object({ reportId: z.string() }),
    outputSchema: z.object({
      status: z.string(),
      serviceCode: z.string().optional(),
      issueId: z.string().optional(),
    }),
  },
  async ({ reportId }) => {
    const db = getDb();
    const ref = db.collection("reports").doc(reportId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error("NOT_FOUND");
    const report = snap.data() as ReportShape;

    const pipeline = [...(report.pipeline ?? [])];
    const pi = pipeline.findIndex((s) => s.step === "perceive");
    const li = pipeline.findIndex((s) => s.step === "locate");
    if (pi < 0 || li < 0) throw new Error("PIPELINE_MALFORMED");

    let analysis: PerceiveOutput | null = report.analysis ?? null;
    let status = report.status;

    // ───── Phase 1: Perceive ─────
    if (pipeline[pi].status !== "done" && !TERMINAL.includes(status)) {
      pipeline[pi] = { ...pipeline[pi], status: "running", startedAt: Timestamp.now() };
      await ref.update({ pipeline, updatedAt: FieldValue.serverTimestamp() });

      const t0 = Date.now();
      analysis = await ai.run("perceive", () =>
        perceive({ mediaPath: report.media.path, rawText: report.rawText }),
      );
      const latencyMs = Date.now() - t0;
      const finishedAt = Timestamp.now();

      if (!analysis) {
        pipeline[pi] = { ...pipeline[pi], status: "error", summary: "Couldn’t analyse the photo", latencyMs, finishedAt, error: "null_output" };
        await ref.update({ pipeline, status: "needs_review", updatedAt: FieldValue.serverTimestamp() });
        return { status: "needs_review" };
      }
      if (!analysis.isCivicIssue || analysis.confidence < 0.5) {
        pipeline[pi] = { ...pipeline[pi], status: "done", summary: "Not a civic issue", latencyMs, finishedAt };
        await ref.update({ analysis: stripUndefined(analysis), pipeline, status: "rejected", updatedAt: FieldValue.serverTimestamp() });
        return { status: "rejected", serviceCode: analysis.serviceCode };
      }
      pipeline[pi] = { ...pipeline[pi], status: "done", summary: `${analysis.serviceName} · ${analysis.severity}`, latencyMs, finishedAt };
      await ref.update({ analysis: stripUndefined(analysis), pipeline, status: "processing", updatedAt: FieldValue.serverTimestamp() });
      status = "processing";
    }

    // ───── Phase 2: Locate + create seed issue ─────
    if (!analysis || !analysis.isCivicIssue || report.issueId || TERMINAL.includes(status)) {
      return { status, serviceCode: analysis?.serviceCode };
    }
    if (pipeline[li].status === "done") return { status, serviceCode: analysis.serviceCode };

    pipeline[li] = { ...pipeline[li], status: "running", startedAt: Timestamp.now() };
    await ref.update({ pipeline, updatedAt: FieldValue.serverTimestamp() });

    const lat = report.location.latitude;
    const lng = report.location.longitude;
    const t1 = Date.now();
    const loc = await ai.run("locate", () => locate(lat, lng));
    const locateLatency = Date.now() - t1;

    // group + slaHours come from serviceCatalog (PerceiveOutput has no `group`).
    const catSnap = await db.collection("serviceCatalog").doc(analysis.serviceCode).get();
    const cat = catSnap.data() as { group?: string; slaHours?: number } | undefined;
    const group = cat?.group ?? "other";
    const slaHours = typeof cat?.slaHours === "number" ? cat.slaHours : 48;

    // Concrete Timestamps (NOT serverTimestamp — that reads back null and freezes the
    // first countdown render).
    const startedMs = Date.now();
    const sla = {
      slaHours,
      startedAt: Timestamp.fromMillis(startedMs),
      deadline: Timestamp.fromMillis(startedMs + slaHours * 3600_000),
      state: "on_track",
    };

    const issueRef = db.collection("issues").doc();
    const issueId = issueRef.id;
    const tracking = trackingId();
    const reportPhotoTokened = report.media.downloadUrl?.includes("token=");
    if (!reportPhotoTokened) console.warn("[intake] beforeMedia downloadUrl has no token — public display may fail", reportId);

    try {
      await db.runTransaction(async (tx) => {
        const fresh = (await tx.get(ref)).data() as ReportShape;
        if (fresh.issueId) throw new Error("ALREADY_LINKED"); // a concurrent kick won
        const issue = {
          id: issueId,
          trackingId: tracking,
          status: "submitted",
          statusNotes: "",
          serviceCode: analysis.serviceCode,
          serviceName: analysis.serviceName,
          group,
          subCategory: analysis.subCategory ?? null,
          severity: analysis.severity,
          hazard: analysis.hazard,
          title: analysis.suggestedTitle,
          description: [analysis.caption, fresh.rawText].filter(Boolean).join(" — "),
          location: fresh.location,
          geohash: geohashOf(lat, lng),
          addressString: loc.addressString,
          ward: loc.ward,
          zone: loc.zone,
          city: loc.city,
          zipcode: loc.zipcode,
          beforeMedia: fresh.media,
          mediaPaths: [fresh.media.path],
          reportCount: 1,
          supporterCount: 1,
          routing: null,
          agencyResponsible: "",
          sla,
          filing: { status: "draft" },
          verification: { required: true, beforeMediaPath: fresh.media.path },
          escalationLevel: 0,
          reporterUid: fresh.reporterUid,
          tags: analysis.tags ?? [],
          isPublic: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        tx.set(issueRef, stripUndefined(issue));
        tx.set(issueRef.collection("activity").doc(), {
          type: "system",
          message: "Issue created",
          actorUid: null,
          createdAt: FieldValue.serverTimestamp(),
        });

        const pl = [...(fresh.pipeline ?? pipeline)];
        const idx = pl.findIndex((s) => s.step === "locate");
        if (idx >= 0) {
          pl[idx] = {
            step: "locate",
            status: "done",
            summary: loc.ward ?? loc.city ?? loc.addressString,
            latencyMs: locateLatency,
            startedAt: pl[idx].startedAt ?? Timestamp.now(),
            finishedAt: Timestamp.now(),
          };
        }
        tx.update(ref, { issueId, isSeed: true, status: "seeded", pipeline: pl, updatedAt: FieldValue.serverTimestamp() });
      });
    } catch (err) {
      if ((err as Error).message === "ALREADY_LINKED") {
        const fresh = (await ref.get()).data() as ReportShape;
        return { status: fresh.status, serviceCode: analysis.serviceCode, issueId: fresh.issueId };
      }
      throw err;
    }

    return { status: "seeded", serviceCode: analysis.serviceCode, issueId };
  },
);

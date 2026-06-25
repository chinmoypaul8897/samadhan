import "server-only";
import { ai, z } from "@/genkit/index";
import { perceive } from "@/genkit/steps/perceive";
import { locate } from "@/genkit/steps/locate";
import { dedup, ACTIVE_ISSUE_STATUSES } from "@/genkit/steps/dedup";
import { getDb } from "@/lib/firebase-admin";
import { trackingId } from "@/lib/trackingId";
import { geohashOf } from "@/lib/geo";
import type { PerceiveOutput } from "@/genkit/schemas";
import { FieldValue, Timestamp, type GeoPoint } from "firebase-admin/firestore";

// The intake pipeline (data-shapes §13). C3 = Perceive; C4 = Locate + seed issue +
// start SLA; C5 = Dedup → link to an existing issue or seed a new one. Persists via
// Admin (reports/issues writes are server-only in the rules). Two independent
// idempotent phases so a re-kick resumes correctly: perceive runs iff not yet done;
// locate+dedup+link/seed runs iff classified-civic and not yet issued.
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

// Immutable patch of one pipeline step by name (preserves the other steps + any fields
// not in the patch, e.g. a running step's startedAt).
function setStep(steps: Step[], step: string, patch: Partial<Step>): Step[] {
  return steps.map((s) => (s.step === step ? { ...s, ...patch } : s));
}

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
    const di = pipeline.findIndex((s) => s.step === "dedup");
    if (pi < 0 || li < 0 || di < 0) throw new Error("PIPELINE_MALFORMED");

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

    // ───── Phase 2: Locate → Dedup → link or seed ─────
    if (!analysis || !analysis.isCivicIssue || report.issueId || TERMINAL.includes(status)) {
      return { status, serviceCode: analysis?.serviceCode };
    }
    if (pipeline[di].status === "done") return { status, serviceCode: analysis.serviceCode };
    const a = analysis; // non-null PerceiveOutput — stable across the closures below

    const lat = report.location.latitude;
    const lng = report.location.longitude;

    // ── Locate (reverse geocode) ── runs on every civic report so the trace narrates
    // "Locate: Koramangala → Dedup: 14 already reported", even when the report links.
    let pl = setStep(pipeline, "locate", { status: "running", startedAt: Timestamp.now() });
    await ref.update({ pipeline: pl, updatedAt: FieldValue.serverTimestamp() });

    const t1 = Date.now();
    const loc = await ai.run("locate", () => locate(lat, lng));
    const locateLatency = Date.now() - t1;
    pl = setStep(pl, "locate", {
      status: "done",
      summary: loc.ward ?? loc.city ?? loc.addressString,
      latencyMs: locateLatency,
      finishedAt: Timestamp.now(),
    });
    await ref.update({ pipeline: pl, updatedAt: FieldValue.serverTimestamp() });

    // ── Dedup (geo candidates + Gemini same-issue compare) ──
    pl = setStep(pl, "dedup", { status: "running", startedAt: Timestamp.now() });
    await ref.update({ pipeline: pl, updatedAt: FieldValue.serverTimestamp() });

    const t2 = Date.now();
    const verdict = await ai.run("dedup", () =>
      dedup({ lat, lng, serviceCode: a.serviceCode, reportMediaPath: report.media.path }),
    );
    const dedupLatency = Date.now() - t2;

    // ── LINK branch: amplify the existing issue (standout #1) ──
    if (verdict.decision === "linked" && verdict.matchedIssueId) {
      const matchedId = verdict.matchedIssueId;
      const n = verdict.matchedSupporterCount ?? 1;
      const dedupSummary = `${n} ${n === 1 ? "citizen" : "citizens"} already reported this`;
      try {
        await db.runTransaction(async (tx) => {
          const issueRef = db.collection("issues").doc(matchedId);
          const issueSnap = await tx.get(issueRef);
          if (!issueSnap.exists) throw new Error("CANDIDATE_GONE");
          const issueData = issueSnap.data() as { status?: string };
          if (!issueData.status || !ACTIVE_ISSUE_STATUSES.has(issueData.status)) {
            throw new Error("CANDIDATE_CLOSED");
          }
          const fresh = (await tx.get(ref)).data() as ReportShape;
          if (fresh.issueId) throw new Error("ALREADY_LINKED"); // a concurrent kick won

          tx.update(issueRef, {
            supporterCount: FieldValue.increment(1),
            reportCount: FieldValue.increment(1),
            mediaPaths: FieldValue.arrayUnion(fresh.media.path),
            updatedAt: FieldValue.serverTimestamp(),
          });
          tx.set(issueRef.collection("activity").doc(), {
            type: "new_supporter",
            message: "Another citizen reported this",
            actorUid: fresh.reporterUid,
            createdAt: FieldValue.serverTimestamp(),
          });

          // Linked reports inherit the issue's routing/filing → route + act are skipped.
          let fpl = [...(fresh.pipeline ?? pl)];
          fpl = setStep(fpl, "dedup", { status: "done", summary: dedupSummary, latencyMs: dedupLatency, finishedAt: Timestamp.now() });
          fpl = setStep(fpl, "route", { status: "skipped", summary: "Inherited from existing issue" });
          fpl = setStep(fpl, "act", { status: "skipped", summary: "Already filed" });

          tx.update(ref, {
            issueId: matchedId,
            isSeed: false,
            dedup: {
              decision: "linked",
              candidateIssueIds: verdict.candidateIssueIds,
              matchedIssueId: matchedId,
              confidence: verdict.confidence,
              reasoning: verdict.reasoning,
            },
            status: "linked",
            pipeline: fpl,
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        return { status: "linked", serviceCode: a.serviceCode, issueId: matchedId };
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "ALREADY_LINKED") {
          const fresh = (await ref.get()).data() as ReportShape;
          return { status: fresh.status, serviceCode: a.serviceCode, issueId: fresh.issueId };
        }
        // Candidate vanished/closed between query and commit → seed a fresh issue.
        if (msg !== "CANDIDATE_GONE" && msg !== "CANDIDATE_CLOSED") throw err;
        console.warn("[intake] dedup candidate unusable, seeding instead:", msg, matchedId);
      }
    }

    // ── SEED branch: create a new issue (the C4 path) ──
    const seedDedup = {
      decision: "new" as const,
      candidateIssueIds: verdict.candidateIssueIds,
      confidence: verdict.decision === "new" ? verdict.confidence : 0,
      reasoning:
        verdict.decision === "new"
          ? verdict.reasoning
          : "Nearest match was no longer available; created a new issue.",
    };
    const seedSummary = verdict.candidateIssueIds.length
      ? "Distinct from nearby reports — new issue"
      : "New issue — no duplicates nearby";

    // group + slaHours come from serviceCatalog (PerceiveOutput has no `group`).
    const catSnap = await db.collection("serviceCatalog").doc(a.serviceCode).get();
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
          serviceCode: a.serviceCode,
          serviceName: a.serviceName,
          group,
          subCategory: a.subCategory ?? null,
          severity: a.severity,
          hazard: a.hazard,
          title: a.suggestedTitle,
          description: [a.caption, fresh.rawText].filter(Boolean).join(" — "),
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
          tags: a.tags ?? [],
          isPublic: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };
        // Write raw — NOT stripUndefined: a JSON round-trip would mangle the Firestore
        // Timestamp (sla.deadline) + GeoPoint (location) into plain objects. No field is
        // undefined here (all null-defaulted), so a direct set is safe.
        tx.set(issueRef, issue);
        tx.set(issueRef.collection("activity").doc(), {
          type: "system",
          message: "Issue created",
          actorUid: null,
          createdAt: FieldValue.serverTimestamp(),
        });

        let fpl = [...(fresh.pipeline ?? pl)];
        fpl = setStep(fpl, "dedup", { status: "done", summary: seedSummary, latencyMs: dedupLatency, finishedAt: Timestamp.now() });
        // Defensive: if a re-kick lost the locate write, mark it done here too.
        fpl = setStep(fpl, "locate", {
          status: "done",
          summary: loc.ward ?? loc.city ?? loc.addressString,
          latencyMs: locateLatency,
          finishedAt: Timestamp.now(),
        });

        tx.update(ref, { issueId, isSeed: true, dedup: seedDedup, status: "seeded", pipeline: fpl, updatedAt: FieldValue.serverTimestamp() });
      });
    } catch (err) {
      if ((err as Error).message === "ALREADY_LINKED") {
        const fresh = (await ref.get()).data() as ReportShape;
        return { status: fresh.status, serviceCode: a.serviceCode, issueId: fresh.issueId };
      }
      throw err;
    }

    return { status: "seeded", serviceCode: a.serviceCode, issueId };
  },
);

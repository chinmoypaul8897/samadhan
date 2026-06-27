import "server-only";
import { ai, z } from "@/genkit/index";
import { perceive } from "@/genkit/steps/perceive";
import { transcribe } from "@/genkit/steps/transcribe";
import { locate } from "@/genkit/steps/locate";
import { dedup, ACTIVE_ISSUE_STATUSES } from "@/genkit/steps/dedup";
import { route } from "@/genkit/steps/route";
import { act } from "@/genkit/steps/act";
import { getDb } from "@/lib/firebase-admin";
import { notifyReporter, issueLink } from "@/lib/notify";
import { trackingId } from "@/lib/trackingId";
import { geohashOf } from "@/lib/geo";
import type { PerceiveOutput, Routing } from "@/genkit/schemas";
import {
  FieldValue,
  Timestamp,
  type GeoPoint,
  type Firestore,
  type DocumentReference,
} from "firebase-admin/firestore";

// The intake pipeline (data-shapes §13). C3 = Perceive; C4 = Locate + seed issue +
// start SLA; C5 = Dedup → link to an existing issue or seed a new one; C6 = Route + Act
// (route to the authority + draft the formal complaint → filing 'prepared'). Persists via
// Admin (reports/issues writes are server-only in the rules). Independent idempotent
// phases so a re-kick resumes: perceive runs iff not done; locate+dedup+link/seed runs iff
// classified-civic and not yet issued; route+act runs iff seeded and not yet done.
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
  voiceNote?: { path: string; downloadUrl: string; transcript?: string; language?: string };
  rawText?: string;
  location: GeoPoint;
  geohash?: string;
  analysis?: PerceiveOutput;
  issueId?: string;
  isSeed?: boolean;
  pipeline: Step[];
};

// Immutable patch of one pipeline step by name (preserves the other steps + any fields
// not in the patch, e.g. a running step's startedAt).
function setStep(steps: Step[], step: string, patch: Partial<Step>): Step[] {
  return steps.map((s) => (s.step === step ? { ...s, ...patch } : s));
}

// ───── Phase 3: Route + Act on a seeded issue (standout #2) ─────
// Route is rules-first/deterministic (badge "Rules"); Act drafts the complaint with Gemini
// (badge "File"·"Gemini") → issue.filing at 'prepared'. Runs sequentially OUTSIDE any
// transaction (Gemini must not hold a tx open) and is idempotent: skip Route if routing is
// set / step settled; skip Act if filing isn't 'draft' / step settled. Re-reads the report
// pipeline + the issue so it works both inline after seed and on a later re-kick.
async function runRouteAct(
  db: Firestore,
  ref: DocumentReference,
  issueId: string,
  a: PerceiveOutput,
): Promise<void> {
  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) return;
  let issue = issueSnap.data() as {
    serviceCode: string;
    serviceName: string;
    city?: string | null;
    ward?: string | null;
    addressString: string;
    title: string;
    description: string;
    trackingId: string;
    severity: string;
    hazard: boolean;
    routing?: Routing | null;
    agencyResponsible?: string;
    filing?: { status?: string };
  };

  let pl = [...(((await ref.get()).data() as ReportShape | undefined)?.pipeline ?? [])];
  const stepStatus = (name: string) => pl.find((s) => s.step === name)?.status;

  // ── Route (rules) ──
  if (!issue.routing && stepStatus("route") !== "done" && stepStatus("route") !== "skipped") {
    pl = setStep(pl, "route", { status: "running", startedAt: Timestamp.now() });
    await ref.update({ pipeline: pl, updatedAt: FieldValue.serverTimestamp() });

    const t = Date.now();
    const r = await ai.run("route", () =>
      route({ serviceCode: a.serviceCode, serviceName: a.serviceName, city: issue.city ?? null }),
    );
    await issueRef.update({
      routing: r.routing,
      agencyResponsible: r.authorityName,
      updatedAt: FieldValue.serverTimestamp(),
    });
    pl = setStep(pl, "route", {
      status: "done",
      summary: `Routed to ${r.authorityShortName} · ${r.routing.department}`,
      latencyMs: Date.now() - t,
      finishedAt: Timestamp.now(),
    });
    await ref.update({ pipeline: pl, updatedAt: FieldValue.serverTimestamp() });
    issue = { ...issue, routing: r.routing, agencyResponsible: r.authorityName };
  }

  // ── Act (Gemini draft → filing 'prepared') ──
  if (
    issue.routing &&
    (issue.filing?.status ?? "draft") === "draft" &&
    stepStatus("act") !== "done" &&
    stepStatus("act") !== "skipped"
  ) {
    const authSnap = await db.collection("authorities").doc(issue.routing.authorityId).get();
    const auth = authSnap.data() as { shortName?: string; name?: string } | undefined;
    const shortName = auth?.shortName ?? issue.routing.authorityId.toUpperCase();

    pl = setStep(pl, "act", { status: "running", startedAt: Timestamp.now() });
    await ref.update({ pipeline: pl, updatedAt: FieldValue.serverTimestamp() });

    const t = Date.now();
    // A non-retryable Gemini throw (safety block / malformed) would otherwise reject the whole
    // flow and freeze the act step at "running" with filing stuck on "draft" → the citizen
    // FilingCard spins "Drafting…" forever. Catch → null and fall into the failed branch.
    const filing = await ai
      .run("act", () =>
        act({
          serviceName: a.serviceName,
          severity: a.severity,
          hazard: a.hazard,
          title: issue.title,
          description: issue.description,
          addressString: issue.addressString,
          ward: issue.ward ?? null,
          trackingId: issue.trackingId,
          languageDetected: a.languageDetected,
          authorityName: issue.agencyResponsible || auth?.name || shortName,
          authorityShortName: shortName,
          department: issue.routing!.department,
          format: "municipal_portal",
        }),
      )
      .catch((err) => {
        console.error("[intake] act threw", issueId, err);
        return null;
      });
    const latencyMs = Date.now() - t;

    if (filing) {
      await issueRef.update({ filing, updatedAt: FieldValue.serverTimestamp() });
      pl = setStep(pl, "act", {
        status: "done",
        summary: `Drafted complaint to ${shortName}`,
        latencyMs,
        finishedAt: Timestamp.now(),
      });
    } else {
      // Mark filing 'failed' so the citizen card shows an honest error state, not a forever
      // spinner. The issue itself is still seeded + tracked; an officer can still act on it.
      await issueRef.update({ "filing.status": "failed", updatedAt: FieldValue.serverTimestamp() });
      pl = setStep(pl, "act", {
        status: "error",
        summary: "Couldn’t draft the complaint",
        latencyMs,
        finishedAt: Timestamp.now(),
        error: "act_failed",
      });
    }
    await ref.update({ pipeline: pl, updatedAt: FieldValue.serverTimestamp() });
  }
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

      // Voice transcription (C13) — if the citizen attached a voice note, Gemini transcribes it
      // (a "transcribe" span before Perceive) and we feed the transcript into Perceive as
      // rawText so it informs classification + languageDetected. Best-effort; never blocks.
      let effectiveRawText = report.rawText;
      if (report.voiceNote?.path && !report.voiceNote.transcript) {
        const vpath = report.voiceNote.path;
        const vt = await ai.run("transcribe", () => transcribe(vpath));
        if (vt) {
          effectiveRawText = [report.rawText, vt.transcript].filter(Boolean).join(" — ");
          await ref.update({
            "voiceNote.transcript": vt.transcript,
            "voiceNote.language": vt.language,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      const t0 = Date.now();
      try {
        analysis = await ai.run("perceive", () =>
          perceive({ mediaPath: report.media.path, rawText: effectiveRawText }),
        );
      } catch (err) {
        // A non-retryable Gemini error (safety block / malformed media) would otherwise reject
        // the whole flow and leave the report frozen at "processing" with perceive "running".
        // Mirror the null-output branch → recoverable needs_review, never stuck.
        console.error("[intake] perceive threw", reportId, err);
        pipeline[pi] = { ...pipeline[pi], status: "error", summary: "Couldn’t analyse the photo", latencyMs: Date.now() - t0, finishedAt: Timestamp.now(), error: "perceive_threw" };
        await ref.update({ pipeline, status: "needs_review", updatedAt: FieldValue.serverTimestamp() });
        return { status: "needs_review" };
      }
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

    // ───── Phase 2: Locate → Dedup → link or seed (runs only until an issue exists) ─────
    let currentIssueId: string | null = report.issueId ?? null;
    let seeded = report.isSeed === true;

    if (
      analysis &&
      analysis.isCivicIssue &&
      !currentIssueId &&
      status === "processing" &&
      pipeline[di].status !== "done"
    ) {
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
          // Ping the seed reporter that support grew (best-effort, post-commit) — C7.
          await notifyReporter(matchedId, {
            title: `Samadhan · ${verdict.matchedTrackingId ?? "your report"}`,
            body: "Another citizen reported this — your issue is gaining support.",
            link: issueLink(matchedId),
            data: { issueId: matchedId, kind: "new_supporter" },
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
      const newIssueId = issueRef.id;
      const tracking = trackingId();
      const reportPhotoTokened = report.media.downloadUrl?.includes("token=");
      if (!reportPhotoTokened) console.warn("[intake] beforeMedia downloadUrl has no token — public display may fail", reportId);

      try {
        await db.runTransaction(async (tx) => {
          const fresh = (await tx.get(ref)).data() as ReportShape;
          if (fresh.issueId) throw new Error("ALREADY_LINKED"); // a concurrent kick won
          const issue = {
            id: newIssueId,
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

          tx.update(ref, { issueId: newIssueId, isSeed: true, dedup: seedDedup, status: "seeded", pipeline: fpl, updatedAt: FieldValue.serverTimestamp() });
        });
      } catch (err) {
        if ((err as Error).message === "ALREADY_LINKED") {
          const fresh = (await ref.get()).data() as ReportShape;
          return { status: fresh.status, serviceCode: a.serviceCode, issueId: fresh.issueId };
        }
        throw err;
      }

      currentIssueId = newIssueId;
      seeded = true;
      status = "seeded";
      // fall through to Phase 3
    }

    // ───── Phase 3: Route + Act on the seeded issue (standout #2) ─────
    // Seeded issues only — linked reports inherit the parent's routing/filing (route + act
    // already 'skipped'). Idempotent: runRouteAct skips whatever is already done.
    if (currentIssueId && seeded && analysis) {
      await runRouteAct(db, ref, currentIssueId, analysis);
    }

    return { status, serviceCode: analysis?.serviceCode, issueId: currentIssueId ?? undefined };
  },
);

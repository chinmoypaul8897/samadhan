import "server-only";
import { getDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { computeSlaState } from "@/lib/sla";
import { transition } from "@/lib/status";
import { notifyReporter, issueLink } from "@/lib/notify";
import { escalate, rungType, rungTarget, type EscalationType } from "@/genkit/steps/escalate";

// SLA sweep (backend-plan C10). The autonomous heartbeat behind standout #3. Runs (via the
// /api/internal/sla-sweep cron) every few minutes and, for each issue past its SLA, flips
// sla.state to breached and drafts the NEXT escalation rung (reminder → appeal → RTI). It also
// auto-verifies stale resolved-pending issues after a grace window (the §8.6 outcome:'auto'
// path — the ONLY non-citizen route to verified_resolved). Pure server logic (Admin); the HTTP
// route is just an auth wrapper, so this is verified directly headless.

const ACTIVE = new Set([
  "submitted",
  "acknowledged",
  "assigned",
  "in_progress",
  "reopened",
]);
const MAX_LEVEL = 3;
const BATCH = 50;

const COOLDOWN_MS = Number(process.env.ESCALATION_COOLDOWN_MS ?? 0);
const GRACE_MS = Number(process.env.GRACE_HOURS ?? 72) * 3600_000;

const RUNG_LABEL: Record<EscalationType, string> = {
  reminder: "a reminder",
  higher_authority_appeal: "a higher-authority appeal",
  rti_draft: "an RTI application",
  social_post: "a public post",
};

type IssueData = {
  status?: string;
  trackingId?: string;
  serviceName?: string;
  severity?: string;
  hazard?: boolean;
  title?: string;
  description?: string;
  addressString?: string;
  ward?: string | null;
  escalationLevel?: number;
  lastEscalatedAt?: Timestamp | null;
  resolvedAt?: Timestamp | null;
  routing?: { authorityId?: string | null } | null;
  filing?: { language?: string };
  sla?: { deadline?: Timestamp; slaHours?: number; state?: string };
};

export type SweepSummary = {
  scanned: number;
  breached: number;
  escalated: number;
  autoVerified: number;
};

/** Draft + persist the next escalation rung for one breached issue. Best-effort. */
async function escalateOne(
  db: FirebaseFirestore.Firestore,
  issueId: string,
  d: IssueData,
  nowMs: number,
): Promise<boolean> {
  const level = (d.escalationLevel ?? 0) + 1;
  if (level > MAX_LEVEL) return false;
  if (d.lastEscalatedAt && nowMs - d.lastEscalatedAt.toMillis() < COOLDOWN_MS) return false;

  const authorityId = d.routing?.authorityId;
  if (!authorityId) return false;
  const authSnap = await db.collection("authorities").doc(authorityId).get();
  if (!authSnap.exists) return false;
  const authority = authSnap.data() as {
    name: string;
    shortName: string;
    escalationContacts?: { level: number; title: string }[];
  };

  const type = rungType(level);
  const target = rungTarget(level, authority);
  const deadlineMs = d.sla?.deadline?.toMillis?.() ?? nowMs;
  const breachedByHours = Math.max(0, (nowMs - deadlineMs) / 3600_000);

  const draft = await escalate({
    level,
    type,
    target,
    serviceName: d.serviceName ?? "civic issue",
    severity: d.severity ?? "medium",
    hazard: Boolean(d.hazard),
    title: d.title ?? "Unresolved civic issue",
    description: d.description ?? "",
    addressString: d.addressString ?? "",
    ward: d.ward ?? null,
    trackingId: d.trackingId ?? "",
    language: d.filing?.language ?? "en",
    authorityName: authority.name,
    authorityShortName: authority.shortName,
    breachedByHours,
    slaHours: d.sla?.slaHours ?? 24,
  });
  if (!draft || !draft.content) return false;

  const issueRef = db.collection("issues").doc(issueId);
  const triggerReason = `SLA breached by ~${Math.round(breachedByHours)}h`;

  await issueRef.collection("escalations").add({
    type,
    status: "drafted",
    channel: "portal",
    content: draft.content,
    target,
    triggerReason,
    reasoning: draft.reasoning ?? "",
    approvedByUid: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  await issueRef.update({
    escalationLevel: level,
    lastEscalatedAt: FieldValue.serverTimestamp(),
    "sla.state": "breached",
    updatedAt: FieldValue.serverTimestamp(),
  });
  await issueRef.collection("activity").add({
    type: "escalation",
    message: `The agent drafted ${RUNG_LABEL[type]} to ${target}`,
    actorUid: null,
    actorRole: "system",
    createdAt: FieldValue.serverTimestamp(),
  });

  await notifyReporter(issueId, {
    title: `Samadhan · ${d.trackingId ?? "your report"}`,
    body: `Deadline missed — the agent drafted ${RUNG_LABEL[type]}. Tap to review & send.`,
    link: issueLink(issueId),
    data: { issueId, kind: "escalation", type, level },
  });
  return true;
}

/** One sweep pass: breach→escalate + auto-verify. Never throws per-issue. */
export async function runSweep(): Promise<SweepSummary> {
  const db = getDb();
  const now = Timestamp.now();
  const nowMs = now.toMillis();
  const summary: SweepSummary = { scanned: 0, breached: 0, escalated: 0, autoVerified: 0 };

  // ── Breach pass: issues past their deadline (single-field range; filter active in code) ──
  const breachSnap = await db
    .collection("issues")
    .where("sla.deadline", "<", now)
    .orderBy("sla.deadline", "asc")
    .limit(BATCH)
    .get();

  for (const doc of breachSnap.docs) {
    summary.scanned++;
    const d = doc.data() as IssueData;
    if (!d.status || !ACTIVE.has(d.status)) continue;
    const deadlineMs = d.sla?.deadline?.toMillis?.();
    if (deadlineMs == null) continue;
    const state = computeSlaState(deadlineMs, d.sla?.slaHours ?? 24, nowMs, null);
    if (state !== "breached") continue;
    summary.breached++;

    try {
      if (d.sla?.state !== "breached") {
        await doc.ref.update({ "sla.state": "breached", updatedAt: FieldValue.serverTimestamp() });
      }
      if (await escalateOne(db, doc.id, d, nowMs)) summary.escalated++;
    } catch (err) {
      console.error("[sweep] breach/escalate failed", doc.id, err);
    }
  }

  // ── Auto-verify pass: resolved-pending older than the grace window (§8.6 outcome:'auto') ──
  const graceCutoff = nowMs - GRACE_MS;
  const pendingSnap = await db
    .collection("issues")
    .where("status", "==", "resolved_pending_verification")
    .limit(BATCH)
    .get();

  for (const doc of pendingSnap.docs) {
    const d = doc.data() as IssueData;
    const resolvedMs = d.resolvedAt?.toMillis?.();
    if (resolvedMs == null || resolvedMs > graceCutoff) continue;
    try {
      await transition(doc.id, {
        to: "verified_resolved",
        actorRole: "system",
        note: "Auto-verified after the confirmation grace window",
        expectedFrom: "resolved_pending_verification",
        patch: {
          "verification.outcome": "auto",
          "verification.finalizedAt": FieldValue.serverTimestamp(),
        },
      });
      summary.autoVerified++;
    } catch (err) {
      console.error("[sweep] auto-verify failed", doc.id, err);
    }
  }

  return summary;
}

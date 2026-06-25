import "server-only";
import { getDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { notifyUser, issueLink } from "@/lib/notify";

// Status state-machine helper (backend-plan C7.1). The single primitive every status
// change flows through — C8 (officer actions), C9 (verify), C10 (escalate/auto-verify) all
// call transition(). Validates the data-shapes §9 transition graph, writes status +
// status_change activity + resolvedAt/verifiedAt, then pushes the reporter. Runs via Admin
// (issues + activity are server-only writes in the rules). Push is fired AFTER the txn
// commits (a network call must never sit inside a Firestore transaction).

export type IssueStatus =
  | "submitted"
  | "acknowledged"
  | "assigned"
  | "in_progress"
  | "resolved_pending_verification"
  | "verified_resolved"
  | "cannot_fix"
  | "reopened";

// Allowed transitions (data-shapes §9). `cannot_fix` is terminal.
export const ALLOWED: Record<IssueStatus, IssueStatus[]> = {
  submitted: ["acknowledged", "cannot_fix"],
  acknowledged: ["assigned", "in_progress", "cannot_fix"],
  assigned: ["in_progress", "cannot_fix"],
  in_progress: ["resolved_pending_verification", "cannot_fix"],
  resolved_pending_verification: ["verified_resolved", "reopened"],
  verified_resolved: ["reopened"],
  reopened: ["in_progress"],
  cannot_fix: [],
};

export function isAllowed(from: IssueStatus, to: IssueStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

const DEFAULT_MESSAGE: Record<IssueStatus, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged by the authority",
  assigned: "Assigned to an officer",
  in_progress: "Work has started",
  resolved_pending_verification: "Marked resolved — please confirm the fix",
  verified_resolved: "Resolved and verified",
  cannot_fix: "Marked cannot fix",
  reopened: "Reopened",
};

export type TransitionInput = {
  to: IssueStatus;
  actorUid?: string | null;
  actorRole?: string | null;
  note?: string; // → statusNotes (reason); also used as the activity message if given
  expectedFrom?: IssueStatus; // optional optimistic guard against a stale read
};

export type TransitionResult = { from: IssueStatus; to: IssueStatus };

/**
 * Move an issue to `to`, enforcing the §9 graph. Throws NOT_FOUND / ILLEGAL_TRANSITION /
 * STALE_STATUS. Writes status/statusNotes/updatedAt (+ resolvedAt/verifiedAt) and a
 * status_change activity row in one transaction; pushes the reporter after commit.
 */
export async function transition(
  issueId: string,
  input: TransitionInput,
): Promise<TransitionResult> {
  const db = getDb();
  const issueRef = db.collection("issues").doc(issueId);
  const { to, actorUid = null, actorRole = null, note, expectedFrom } = input;

  const committed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(issueRef);
    if (!snap.exists) throw new Error("NOT_FOUND");
    const issue = snap.data() as { status: IssueStatus; reporterUid?: string; trackingId?: string };
    const from = issue.status;

    if (expectedFrom && expectedFrom !== from) throw new Error("STALE_STATUS");
    if (!isAllowed(from, to)) throw new Error("ILLEGAL_TRANSITION");

    const patch: Record<string, unknown> = {
      status: to,
      statusNotes: note ?? "",
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (to === "resolved_pending_verification") patch.resolvedAt = FieldValue.serverTimestamp();
    if (to === "verified_resolved") patch.verifiedAt = FieldValue.serverTimestamp();
    // Reopening clears the resolution so the SLA clock resumes against the live deadline.
    if (to === "reopened") {
      patch.resolvedAt = null;
      patch.verifiedAt = null;
    }
    tx.update(issueRef, patch);

    tx.set(issueRef.collection("activity").doc(), {
      type: "status_change",
      message: note || DEFAULT_MESSAGE[to],
      actorUid,
      actorRole,
      fromStatus: from,
      toStatus: to,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { from, to, reporterUid: issue.reporterUid, trackingId: issue.trackingId };
  });

  // Push the reporter (best-effort, post-commit).
  if (committed.reporterUid) {
    await notifyUser(committed.reporterUid, {
      title: `Samadhan · ${committed.trackingId ?? "your report"}`,
      body: DEFAULT_MESSAGE[to],
      link: issueLink(issueId),
      data: { issueId, trackingId: committed.trackingId ?? "", toStatus: to, kind: "status_change" },
    });
  }

  return { from: committed.from, to: committed.to };
}

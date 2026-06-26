import { transition, type IssueStatus } from "@/lib/status";
import { requireOfficer } from "@/lib/claims";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// C7 demo trigger for a status change (backend-plan C7 — the officer portal that drives real
// transitions is C8, built on this same transition() primitive). C12: gated by requireOfficer
// (verified Firebase ID token + role claim) instead of the old body-uid → users-doc lookup, so
// it's no longer a spoofable status-change backdoor. actorUid/actorRole come from the token.

const STATUSES: IssueStatus[] = [
  "submitted",
  "acknowledged",
  "assigned",
  "in_progress",
  "resolved_pending_verification",
  "verified_resolved",
  "cannot_fix",
  "reopened",
];

export async function POST(req: Request) {
  let body: { issueId?: string; to?: string; note?: string; expectedFrom?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty/invalid body → BAD_REQUEST below
  }
  const { issueId, to, note, expectedFrom } = body;

  try {
    const officer = await requireOfficer(req);
    if (!issueId || !to) throw new Error("BAD_REQUEST");
    if (!STATUSES.includes(to as IssueStatus)) throw new Error("BAD_REQUEST");

    const result = await transition(issueId, {
      to: to as IssueStatus,
      actorUid: officer.uid,
      actorRole: officer.role,
      note,
      expectedFrom: expectedFrom as IssueStatus | undefined,
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err, "internal/transition");
  }
}

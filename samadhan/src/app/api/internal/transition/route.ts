import { getDb } from "@/lib/firebase-admin";
import { transition, type IssueStatus } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// C7 demo trigger for a status change (backend-plan C7 — the officer portal that drives
// real transitions is C8, built on this same transition() primitive). Role-gated to
// officer/admin via the users/{actorUid}.role field (demo-grade, like /api/issues/[id]/file
// — there is no ID-token verification yet; real auth + jurisdiction is C8/C12). Any caller
// must supply a seeded staff uid.

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
  let body: { issueId?: string; to?: string; actorUid?: string; note?: string; expectedFrom?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty/invalid body → BAD_REQUEST below
  }
  const { issueId, to, actorUid, note, expectedFrom } = body;

  try {
    if (!issueId || !to || !actorUid) throw new Error("BAD_REQUEST");
    if (!STATUSES.includes(to as IssueStatus)) throw new Error("BAD_REQUEST");

    // Gate: actor must be a seeded officer/admin (role read from the users doc).
    const actorSnap = await getDb().collection("users").doc(actorUid).get();
    const role = actorSnap.data()?.role as string | undefined;
    if (role !== "officer" && role !== "admin") throw new Error("FORBIDDEN");

    const result = await transition(issueId, {
      to: to as IssueStatus,
      actorUid,
      actorRole: role,
      note,
      expectedFrom: expectedFrom as IssueStatus | undefined,
    });
    return Response.json({ ok: true, ...result });
  } catch (err) {
    const msg = (err as Error).message;
    const status =
      msg === "BAD_REQUEST"
        ? 400
        : msg === "FORBIDDEN"
          ? 403
          : msg === "NOT_FOUND"
            ? 404
            : msg === "ILLEGAL_TRANSITION" || msg === "STALE_STATUS"
              ? 409
              : 500;
    if (status === 500) console.error("[internal/transition] failed", err);
    return Response.json({ ok: false, error: msg }, { status });
  }
}

import { getDb } from "@/lib/firebase-admin";
import { requireOfficer, assertJurisdiction } from "@/lib/claims";
import { transition, type IssueStatus } from "@/lib/status";
import { runVerify } from "@/genkit/steps/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Officer action (backend-plan C8.2). requireOfficer + assertJurisdiction, then map the action
// onto the §9 transition graph via transition() (which logs the status_change activity + pushes
// the citizen). assign sets assignedOfficerUid; resolve REQUIRES a proof-of-fix afterMediaPath
// (anti-pattern guard — no resolve without evidence) and writes verification.afterMediaPath;
// cannot_fix REQUIRES a note. Side-fields ride the same txn via transition()'s `patch`.

type Action = "acknowledge" | "assign" | "start" | "resolve" | "cannot_fix";
const ACTIONS: Action[] = ["acknowledge", "assign", "start", "resolve", "cannot_fix"];

// action → target status (the graph itself rejects illegal current→target moves with 409).
const TARGET: Record<Action, IssueStatus> = {
  acknowledge: "acknowledged",
  assign: "assigned",
  start: "in_progress",
  resolve: "resolved_pending_verification",
  cannot_fix: "cannot_fix",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { action?: string; note?: string; afterMediaPath?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty/invalid body → BAD_REQUEST below
  }
  const { action, note, afterMediaPath } = body;

  try {
    const officer = await requireOfficer(req);

    if (!action || !ACTIONS.includes(action as Action)) throw new Error("BAD_REQUEST");
    const act = action as Action;

    const db = getDb();
    const snap = await db.collection("issues").doc(id).get();
    if (!snap.exists) throw new Error("NOT_FOUND");
    const issue = snap.data() as {
      status: IssueStatus;
      routing?: { authorityId?: string | null } | null;
    };

    assertJurisdiction(officer, issue);

    // Per-action requirements (proof-of-fix / reason).
    if (act === "resolve" && !afterMediaPath) throw new Error("MISSING_PHOTO");
    if (act === "cannot_fix" && !(note && note.trim())) throw new Error("MISSING_NOTE");

    const patch: Record<string, unknown> = {};
    if (act === "assign") patch.assignedOfficerUid = officer.uid;
    if (act === "resolve") {
      patch["verification.required"] = true;
      patch["verification.afterMediaPath"] = afterMediaPath;
    }

    const result = await transition(id, {
      to: TARGET[act],
      actorUid: officer.uid,
      actorRole: officer.role,
      note,
      expectedFrom: issue.status, // optimistic guard against a concurrent move
      patch: Object.keys(patch).length ? patch : undefined,
    });

    // On resolve, run the agent's before/after verdict (C9) before returning, so the verdict
    // is already on the issue when the citizen opens. The resolve has already committed, so a
    // verify failure is harmless (runVerify never throws). The brief wait is visible "the
    // agent is verifying the fix" work on the officer's resolve tap.
    if (act === "resolve") await runVerify(id);

    return Response.json({ ok: true, action: act, ...result });
  } catch (err) {
    const msg = (err as Error).message;
    const status =
      msg === "BAD_REQUEST" || msg === "MISSING_PHOTO" || msg === "MISSING_NOTE"
        ? 400
        : msg === "UNAUTHENTICATED"
          ? 401
          : msg === "FORBIDDEN"
            ? 403
            : msg === "NOT_FOUND"
              ? 404
              : msg === "ILLEGAL_TRANSITION" || msg === "STALE_STATUS"
                ? 409
                : 500;
    if (status === 500) console.error("[officer/action] failed", err);
    return Response.json({ ok: false, error: msg }, { status });
  }
}

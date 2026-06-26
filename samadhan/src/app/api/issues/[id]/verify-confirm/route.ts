import { getDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { transition, type IssueStatus } from "@/lib/status";
import { notifyUser, issueLink } from "@/lib/notify";
import { requireCitizen } from "@/lib/claims";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Citizen verify-confirm (backend-plan C9, standout #3). On resolved_pending_verification the
// citizen decides: confirmed → verified_resolved (the ONLY citizen path to a closed issue —
// the AI verdict is advisory and never finalises); denied → reopened (SLA clock resumes). The
// officer is notified either way. Runs via Admin (issues are server-only writes) and goes
// through transition() so the §9 graph + status_change activity + reporter push are consistent.
//
// C12: owner-auth is a real Firebase ID-token check (requireCitizen) — the uid comes from the
// verified token, never the body. `confirmed` is still a body field (validated boolean).

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { confirmed?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // empty/invalid body → BAD_REQUEST below
  }
  const { confirmed } = body;

  try {
    const { uid } = await requireCitizen(req);
    if (typeof confirmed !== "boolean") throw new Error("BAD_REQUEST");

    const db = getDb();
    const snap = await db.collection("issues").doc(id).get();
    if (!snap.exists) throw new Error("NOT_FOUND");
    const issue = snap.data() as {
      reporterUid?: string;
      status?: IssueStatus;
      assignedOfficerUid?: string | null;
      trackingId?: string;
    };

    if (uid !== issue.reporterUid) throw new Error("FORBIDDEN");

    // Idempotency: a repeated tap after the move already landed is a no-op, not a 409.
    if (issue.status !== "resolved_pending_verification") {
      if (confirmed && issue.status === "verified_resolved") return Response.json({ ok: true, already: true });
      if (!confirmed && (issue.status === "reopened" || issue.status === "in_progress"))
        return Response.json({ ok: true, already: true });
      throw new Error("STALE_STATUS");
    }

    const finalize = {
      "verification.citizenConfirmed": confirmed,
      "verification.confirmedByUid": uid,
      "verification.outcome": confirmed ? "verified" : "rejected",
      "verification.finalizedAt": FieldValue.serverTimestamp(),
    };

    const result = await transition(id, {
      to: confirmed ? "verified_resolved" : "reopened",
      actorUid: uid,
      actorRole: "citizen",
      note: confirmed ? "Citizen confirmed the fix" : "Citizen reported it’s still not fixed",
      expectedFrom: "resolved_pending_verification",
      patch: finalize,
    });

    // Tell the officer who resolved it (best-effort; never blocks the confirm).
    if (issue.assignedOfficerUid) {
      await notifyUser(issue.assignedOfficerUid, {
        title: `Samadhan · ${issue.trackingId ?? "issue"}`,
        body: confirmed ? "Citizen confirmed the fix — resolved." : "Citizen says it’s still not fixed — reopened.",
        link: issueLink(id),
        data: { issueId: id, kind: "verify_outcome", outcome: confirmed ? "verified" : "rejected" },
      });
    }

    return Response.json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err, "verify-confirm");
  }
}

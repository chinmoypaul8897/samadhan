import { getDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireCitizen } from "@/lib/claims";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-tap file (backend-plan C6, standout #2). The citizen consents → the prepared
// complaint is "filed" to the simulated officer portal: filing.status draft/prepared →
// submitted, recording submittedAt + consentByUid, and a "Complaint filed" activity row.
// Issues are server-only writes in the rules (clients can't flip filing), so this runs via
// Admin and validates the caller is the issue's reporter.
//
// C12: owner-auth is now a real Firebase ID-token check (requireCitizen) — the uid comes
// from the verified token, NOT the request body, so a crafted POST can't file as another
// citizen. Anonymous reporters still pass (anon tokens carry a stable uid).

const ACTIVE = new Set([
  "submitted",
  "acknowledged",
  "assigned",
  "in_progress",
  "resolved_pending_verification",
  "reopened",
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const db = getDb();
  const issueRef = db.collection("issues").doc(id);

  try {
    const { uid } = await requireCitizen(req);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(issueRef);
      if (!snap.exists) throw new Error("NOT_FOUND");
      const issue = snap.data() as {
        reporterUid?: string;
        status?: string;
        agencyResponsible?: string;
        filing?: { status?: string };
      };

      if (uid !== issue.reporterUid) throw new Error("FORBIDDEN");
      if (!issue.status || !ACTIVE.has(issue.status)) throw new Error("ISSUE_CLOSED");

      const fstatus = issue.filing?.status;
      if (fstatus === "submitted") return { ok: true, already: true }; // idempotent no-op
      if (fstatus !== "prepared") throw new Error("NOT_PREPARED");

      // Dotted paths merge — keep complaintText/language/format intact.
      tx.update(issueRef, {
        "filing.status": "submitted",
        "filing.submittedAt": FieldValue.serverTimestamp(),
        "filing.consentByUid": uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(issueRef.collection("activity").doc(), {
        type: "system",
        message: `Complaint filed to ${issue.agencyResponsible || "the authority"}`,
        actorUid: uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, already: false };
    });

    return Response.json(result);
  } catch (err) {
    return errorResponse(err, "file");
  }
}

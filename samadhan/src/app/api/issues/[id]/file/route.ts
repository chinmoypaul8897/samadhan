import { getDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-tap file (backend-plan C6, standout #2). The citizen consents → the prepared
// complaint is "filed" to the simulated officer portal: filing.status draft/prepared →
// submitted, recording submittedAt + consentByUid, and a "Complaint filed" activity row.
// Issues are server-only writes in the rules (clients can't flip filing), so this runs via
// Admin and validates the caller is the issue's reporter.
//
// Owner-auth is demo-grade for C6: the client sends its uid and we check it against
// issue.reporterUid. Real Firebase ID-token verification is deferred to C12 (no
// verifyIdToken helper exists yet — see progress.md). Anonymous reporters have a stable
// uid, so the owner match holds.

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

  let body: { uid?: string } = {};
  try {
    body = (await req.json()) as { uid?: string };
  } catch {
    // empty/invalid body → uid stays undefined → FORBIDDEN below
  }
  const uid = body.uid;

  const db = getDb();
  const issueRef = db.collection("issues").doc(id);

  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(issueRef);
      if (!snap.exists) throw new Error("NOT_FOUND");
      const issue = snap.data() as {
        reporterUid?: string;
        status?: string;
        agencyResponsible?: string;
        filing?: { status?: string };
      };

      if (!uid || uid !== issue.reporterUid) throw new Error("FORBIDDEN");
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
    const msg = (err as Error).message;
    const status =
      msg === "NOT_FOUND" ? 404 : msg === "FORBIDDEN" ? 403 : msg === "ISSUE_CLOSED" || msg === "NOT_PREPARED" ? 409 : 500;
    if (status === 500) console.error("[file] failed", err);
    return Response.json({ ok: false, error: msg }, { status });
  }
}

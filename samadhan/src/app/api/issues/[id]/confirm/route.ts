import { getDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireCitizen } from "@/lib/claims";
import { errorResponse } from "@/lib/http";
import { notifyReporter, issueLink } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Me-too / "this affects me too" (backend-plan C13.3, data-shapes §6). A citizen one-tap that
// amplifies an existing public issue: +1 supporterCount, a `new_supporter` activity row, and a
// `confirmations/{uid}` doc that enforces one-per-uid (re-tap → idempotent no-op). Mirrors the
// C5 dedup LINK write but increments supporterCount ONLY (a me-too is a confirmer, not a full
// report → reportCount untouched). Owner-auth via the verified ID token (C12 requireCitizen);
// runs via Admin (issues are server-only writes). The seed reporter is pinged (best-effort).

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const db = getDb();
  const issueRef = db.collection("issues").doc(id);

  try {
    const { uid } = await requireCitizen(req);

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(issueRef);
      if (!snap.exists) throw new Error("NOT_FOUND");
      const issue = snap.data() as { reporterUid?: string; isPublic?: boolean };
      if (issue.isPublic === false) throw new Error("FORBIDDEN"); // only public issues are amplifiable

      // The seed reporter already counts as a supporter — nothing to add.
      if (uid === issue.reporterUid) return { ok: true, already: true };

      const myConfirm = issueRef.collection("confirmations").doc(uid);
      const existing = await tx.get(myConfirm);
      if (existing.exists) return { ok: true, already: true }; // one me-too per uid

      tx.set(myConfirm, { uid, createdAt: FieldValue.serverTimestamp() });
      tx.update(issueRef, {
        supporterCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(issueRef.collection("activity").doc(), {
        type: "new_supporter",
        message: "Another citizen is affected by this",
        actorUid: uid,
        actorRole: "citizen",
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, already: false };
    });

    // Ping the seed reporter that support grew (best-effort, post-commit, only on a fresh tap).
    if (!result.already) {
      await notifyReporter(id, {
        title: "Samadhan · your report",
        body: "Another citizen says they're affected too — your issue is gaining support.",
        link: issueLink(id),
        data: { issueId: id, kind: "new_supporter" },
      });
    }

    return Response.json(result);
  } catch (err) {
    return errorResponse(err, "confirm");
  }
}

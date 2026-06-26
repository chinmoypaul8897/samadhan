import { getDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireCitizen } from "@/lib/claims";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Community fix-verification (data-shapes §6 fixConfirmations / §8.6). On a
// resolved_pending_verification issue, an AFFECTED citizen (not the reporter) confirms or
// disputes the officer's fix: a fixConfirmations/{uid} doc (one per uid, idempotent re-tap) +
// verification.community{Fixed,Broken}Count increment + a verification activity row. ADVISORY
// ONLY — it does NOT change status; only the reporter's verify-confirm or the auto-verify sweep
// finalises verified_resolved (§8.6 — AI/crowd never auto-close). Owner-auth via the verified
// ID token; runs via Admin (issues are server-only writes), so fixConfirmations write is
// server-only and the counter increments atomically with the vote doc.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const issueRef = db.collection("issues").doc(id);

  try {
    const { uid } = await requireCitizen(req);

    let body: { verdict?: string } = {};
    try {
      body = (await req.json()) as typeof body;
    } catch {
      // empty/invalid body → BAD_REQUEST below
    }
    const verdict = body.verdict;
    if (verdict !== "fixed" && verdict !== "broken") throw new Error("BAD_REQUEST");

    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(issueRef);
      if (!snap.exists) throw new Error("NOT_FOUND");
      const issue = snap.data() as { reporterUid?: string; isPublic?: boolean; status?: string };
      if (issue.isPublic === false) throw new Error("FORBIDDEN"); // only public issues
      if (issue.status !== "resolved_pending_verification") throw new Error("STALE_STATUS");
      // The reporter finalises via /verify-confirm — they don't cast a community vote.
      if (uid === issue.reporterUid) return { ok: true, already: true };

      const myVote = issueRef.collection("fixConfirmations").doc(uid);
      const existing = await tx.get(myVote);
      if (existing.exists) return { ok: true, already: true }; // one vote per uid

      tx.set(myVote, { uid, verdict, createdAt: FieldValue.serverTimestamp() });
      tx.update(issueRef, {
        [verdict === "fixed"
          ? "verification.communityFixedCount"
          : "verification.communityBrokenCount"]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(issueRef.collection("activity").doc(), {
        type: "verification",
        message:
          verdict === "fixed"
            ? "An affected citizen confirms this looks fixed"
            : "An affected citizen says it’s still broken",
        actorUid: uid,
        actorRole: "citizen",
        createdAt: FieldValue.serverTimestamp(),
      });
      return { ok: true, already: false };
    });

    return Response.json(result);
  } catch (err) {
    return errorResponse(err, "fix-confirm");
  }
}

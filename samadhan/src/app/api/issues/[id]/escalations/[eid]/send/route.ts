import { getDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireCitizen } from "@/lib/claims";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-tap escalation send (backend-plan C10.5). The agent DRAFTS escalations autonomously, but
// sending one (an RTI / appeal to officials) stays the citizen's explicit consent — no
// auto-posting. This flips the escalation to 'sent' (records sentAt + approvedByUid) and logs
// it. Runs via Admin (escalations are server-only writes in the rules).
//
// C12: owner-auth is a real Firebase ID-token check (requireCitizen) — the uid comes from the
// verified token, not the request body.

const TYPE_LABEL: Record<string, string> = {
  reminder: "reminder",
  higher_authority_appeal: "appeal",
  rti_draft: "RTI application",
  social_post: "public post",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; eid: string }> },
) {
  const { id, eid } = await params;

  const db = getDb();
  const issueRef = db.collection("issues").doc(id);
  const escRef = issueRef.collection("escalations").doc(eid);

  try {
    const { uid } = await requireCitizen(req);

    const issueSnap = await issueRef.get();
    if (!issueSnap.exists) throw new Error("NOT_FOUND");
    if (uid !== (issueSnap.data()?.reporterUid as string | undefined)) throw new Error("FORBIDDEN");

    const escSnap = await escRef.get();
    if (!escSnap.exists) throw new Error("NOT_FOUND");
    const esc = escSnap.data() as { status?: string; type?: string };

    if (esc.status === "sent") return Response.json({ ok: true, already: true });

    await escRef.update({
      status: "sent",
      sentAt: FieldValue.serverTimestamp(),
      approvedByUid: uid,
    });
    await issueRef.collection("activity").add({
      type: "escalation",
      message: `Escalation sent: ${TYPE_LABEL[esc.type ?? ""] ?? "escalation"}`,
      actorUid: uid,
      actorRole: "citizen",
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true, already: false });
  } catch (err) {
    return errorResponse(err, "escalation/send");
  }
}

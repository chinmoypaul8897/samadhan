import { getDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-tap escalation send (backend-plan C10.5). The agent DRAFTS escalations autonomously, but
// sending one (an RTI / appeal to officials) stays the citizen's explicit consent — no
// auto-posting. This flips the escalation to 'sent' (records sentAt + approvedByUid) and logs
// it. Runs via Admin (escalations are server-only writes in the rules). Owner-auth is demo-grade
// (uid from the body checked against issue.reporterUid, like /file / verify-confirm) — real
// ID-token verification is the C12 retrofit.

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

  let body: { uid?: string } = {};
  try {
    body = (await req.json()) as { uid?: string };
  } catch {
    // empty/invalid body → uid undefined → FORBIDDEN below
  }
  const uid = body.uid;

  const db = getDb();
  const issueRef = db.collection("issues").doc(id);
  const escRef = issueRef.collection("escalations").doc(eid);

  try {
    if (!uid) throw new Error("FORBIDDEN");

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
    const msg = (err as Error).message;
    const status = msg === "NOT_FOUND" ? 404 : msg === "FORBIDDEN" ? 403 : 500;
    if (status === 500) console.error("[escalation/send] failed", err);
    return Response.json({ ok: false, error: msg }, { status });
  }
}

import "server-only";
import { ai, MODEL } from "@/genkit/index";
import { VerifyVerdict } from "@/genkit/schemas";
import { withRetry } from "@/lib/retry";
import { getBucket, getDb } from "@/lib/firebase-admin";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";

// Verify step (backend-plan C9, standout #3). When an officer resolves, the agent compares
// the originally reported photo with the officer's "after" proof and judges whether the
// problem is actually fixed — independently of the officer's word. The verdict is ADVISORY:
// it's shown to the citizen, but only the citizen's confirm (or the C10 grace sweep) ever
// finalises `verified_resolved`. AI never auto-closes (data-shapes §8.6).
//
// Bindings: backend-plan A.2 multi-image — same proven pattern as steps/dedup.ts
// (download both images via Admin → data URLs → ai.generate with paired media blocks).

const VERIFY_QUESTION = [
  "The FIRST photo is a civic problem a citizen reported (e.g. a pothole, a pile of garbage,",
  "a broken streetlight). The SECOND photo is what a field officer uploaded as PROOF that they",
  "have FIXED it.",
  "Judge two things, skeptically:",
  "(1) resolved — is the reported problem actually gone / repaired in the second photo?",
  "(2) sameLocation — does the second photo plausibly show the SAME place/scene as the first",
  "(same road, same spot), rather than an unrelated location?",
  "Set resolved=false if the problem clearly persists OR the after photo is unrelated.",
  "Set sameLocation=false if the two photos look like different places.",
  "Give confidence 0..1 (your certainty in the resolved judgement) and one short reasoning sentence.",
].join(" ");

async function imageDataUrl(path: string): Promise<string> {
  const [buf] = await getBucket().file(path).download();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

/** Gemini before/after compare. Returns the verdict, or null if unavailable after retries. */
export async function verify(input: {
  beforeMediaPath: string;
  afterMediaPath: string;
}): Promise<VerifyVerdict | null> {
  const [before, after] = await Promise.all([
    imageDataUrl(input.beforeMediaPath),
    imageDataUrl(input.afterMediaPath),
  ]);
  return withRetry(async () => {
    const res = await ai.generate({
      model: MODEL,
      prompt: [
        { text: "FIRST photo (the originally reported civic problem):" },
        { media: { url: before } },
        { text: "SECOND photo (the officer's proof that it is now fixed):" },
        { media: { url: after } },
        { text: VERIFY_QUESTION },
      ],
      output: { schema: VerifyVerdict },
    });
    return res.output;
  });
}

export type AiVerdict = {
  resolved: boolean;
  confidence: number;
  reasoning: string;
  gpsMatch: boolean;
  timestampMatch: boolean;
  checkedAt: Timestamp;
};

/**
 * Run the agent verdict for a freshly-resolved issue and persist it to
 * `verification.aiVerdict`. Best-effort: a failure leaves the verdict absent (the citizen
 * still confirms manually) and never throws — the resolve has already committed. Guards on
 * the issue being in resolved_pending_verification with an after photo so a re-call is safe.
 */
export async function runVerify(issueId: string): Promise<void> {
  try {
    const db = getDb();
    const ref = db.collection("issues").doc(issueId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const issue = snap.data() as {
      status?: string;
      verification?: { beforeMediaPath?: string; afterMediaPath?: string };
      beforeMedia?: { path?: string };
      resolvedAt?: Timestamp | null;
      createdAt?: Timestamp | null;
    };
    if (issue.status !== "resolved_pending_verification") return;

    const beforePath = issue.verification?.beforeMediaPath || issue.beforeMedia?.path;
    const afterPath = issue.verification?.afterMediaPath;
    if (!beforePath || !afterPath) return;

    const verdict = await verify({ beforeMediaPath: beforePath, afterMediaPath: afterPath });
    if (!verdict) return; // unavailable → leave absent; the citizen card falls back gracefully

    // timestampMatch: the proof was provided after the report was filed (a backdated "after"
    // would be suspicious). resolvedAt is set by the resolve transition; createdAt by intake.
    const resolvedMs = issue.resolvedAt?.toMillis?.() ?? Date.now();
    const createdMs = issue.createdAt?.toMillis?.() ?? 0;

    const aiVerdict = {
      resolved: verdict.resolved,
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
      gpsMatch: verdict.sameLocation, // visual same-location stand-in (see data-shapes §8.6)
      timestampMatch: resolvedMs > createdMs,
      checkedAt: FieldValue.serverTimestamp(),
    };
    await ref.update({ "verification.aiVerdict": aiVerdict, updatedAt: FieldValue.serverTimestamp() });
  } catch (err) {
    console.error("[verify] runVerify failed", issueId, err);
  }
}

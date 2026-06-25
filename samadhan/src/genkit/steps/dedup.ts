import "server-only";
import { ai, MODEL } from "@/genkit/index";
import { DedupVerdict } from "@/genkit/schemas";
import { withRetry } from "@/lib/retry";
import { getBucket, getDb } from "@/lib/firebase-admin";
import { geohashQueryBounds, distanceMeters } from "@/lib/geo";

// Dedup step (backend-plan C5). Before seeding, find active same-category issues within
// 50 m of the new report, then ask Gemini whether the nearest is the SAME physical
// problem. Returns a decision the flow applies in a transaction (link vs seed). Never
// throws — any failure degrades to a geo-only decision so issue creation never blocks.

// An issue is a dedup target only while it's still open work. A report near a CLOSED
// issue (verified_resolved / cannot_fix) seeds a fresh issue — a recurrence must not be
// silently merged into a closed one (data-shapes §9; "never silently close").
export const ACTIVE_ISSUE_STATUSES = new Set([
  "submitted",
  "acknowledged",
  "assigned",
  "in_progress",
  "resolved_pending_verification",
  "reopened",
]);

const MATCH_RADIUS_M = 50;
const GEO_FALLBACK_RADIUS_M = 20; // tighter radius when the AI compare is unavailable
const MIN_CONFIDENCE = 0.6;

type Candidate = {
  issueId: string;
  beforeMediaPath: string;
  distanceM: number;
  supporterCount: number;
  trackingId: string;
};

export type DedupDecision = {
  decision: "new" | "linked";
  candidateIssueIds: string[];
  confidence: number;
  reasoning: string;
  matchedIssueId?: string;
  matchedSupporterCount?: number;
  matchedTrackingId?: string;
};

const DEDUP_QUESTION = [
  "Do these two photos show the SAME specific physical civic problem (the same pothole,",
  "the same pile of garbage, the same broken streetlight at the same spot) — not merely",
  "the same category of problem?",
  "They are already known to be the same service type within ~50 metres of each other.",
  "Set sameIssue=true ONLY if they plausibly depict the same specific object/location.",
  "Set sameIssue=false if they look like two distinct problems that happen to be nearby.",
  "Give confidence 0..1 and one short reasoning sentence.",
].join(" ");

async function findCandidates(
  lat: number,
  lng: number,
  serviceCode: string,
): Promise<Candidate[]> {
  const db = getDb();
  const bounds = geohashQueryBounds([lat, lng], MATCH_RADIUS_M);
  const snaps = await Promise.all(
    bounds.map(([start, end]) =>
      db
        .collection("issues")
        .where("serviceCode", "==", serviceCode)
        .orderBy("geohash")
        .startAt(start)
        .endAt(end)
        .get(),
    ),
  );

  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const snap of snaps) {
    for (const doc of snap.docs) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      const d = doc.data();
      if (!ACTIVE_ISSUE_STATUSES.has(d.status)) continue;
      const loc = d.location; // admin GeoPoint
      if (!loc) continue;
      const distanceM = distanceMeters([lat, lng], [loc.latitude, loc.longitude]);
      if (distanceM > MATCH_RADIUS_M) continue; // geohash bounds are coarse — exact filter
      out.push({
        issueId: doc.id,
        beforeMediaPath: d.beforeMedia?.path,
        distanceM,
        supporterCount: typeof d.supporterCount === "number" ? d.supporterCount : 1,
        trackingId: d.trackingId ?? "",
      });
    }
  }
  out.sort((a, b) => a.distanceM - b.distanceM);
  return out.slice(0, 3);
}

async function imageDataUrl(path: string): Promise<string> {
  const [buf] = await getBucket().file(path).download();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

async function confirmSameIssue(
  reportMediaPath: string,
  candidatePath: string,
): Promise<DedupVerdict | null> {
  const [a, b] = await Promise.all([
    imageDataUrl(reportMediaPath),
    imageDataUrl(candidatePath),
  ]);
  return withRetry(async () => {
    const res = await ai.generate({
      model: MODEL,
      prompt: [
        { text: "FIRST photo (the newly reported issue):" },
        { media: { url: a } },
        { text: "SECOND photo (an existing report within ~50 m, same category):" },
        { media: { url: b } },
        { text: DEDUP_QUESTION },
      ],
      output: { schema: DedupVerdict },
    });
    return res.output;
  });
}

export async function dedup(input: {
  lat: number;
  lng: number;
  serviceCode: string;
  reportMediaPath: string;
}): Promise<DedupDecision> {
  const { lat, lng, serviceCode, reportMediaPath } = input;

  const candidates = await findCandidates(lat, lng, serviceCode);
  const candidateIssueIds = candidates.map((c) => c.issueId);

  if (candidates.length === 0) {
    return {
      decision: "new",
      candidateIssueIds,
      confidence: 0,
      reasoning: "No nearby reports of this type.",
    };
  }

  const nearest = candidates[0];
  const linkedFor = (confidence: number, reasoning: string): DedupDecision => ({
    decision: "linked",
    candidateIssueIds,
    confidence,
    reasoning,
    matchedIssueId: nearest.issueId,
    matchedSupporterCount: nearest.supporterCount,
    matchedTrackingId: nearest.trackingId,
  });

  // No comparable photo on the candidate → fall back to geo-only at the tight radius.
  if (!nearest.beforeMediaPath) {
    return nearest.distanceM <= GEO_FALLBACK_RADIUS_M
      ? linkedFor(0.5, `Same category within ${Math.round(nearest.distanceM)} m (no photo to compare).`)
      : {
          decision: "new",
          candidateIssueIds,
          confidence: 0,
          reasoning: "Nearby same-category issue had no comparable photo.",
        };
  }

  const verdict = await confirmSameIssue(reportMediaPath, nearest.beforeMediaPath);

  // AI unavailable after retries → geo-only fallback at the tighter radius (a false
  // duplicate is worse than a second issue, so only link when very close).
  if (!verdict) {
    return nearest.distanceM <= GEO_FALLBACK_RADIUS_M
      ? linkedFor(0.5, `Visual compare unavailable; linked on proximity (${Math.round(nearest.distanceM)} m).`)
      : {
          decision: "new",
          candidateIssueIds,
          confidence: 0,
          reasoning: "Visual compare unavailable and nearest match not close enough.",
        };
  }

  if (verdict.sameIssue && verdict.confidence >= MIN_CONFIDENCE) {
    return linkedFor(verdict.confidence, verdict.reasoning);
  }

  return {
    decision: "new",
    candidateIssueIds,
    confidence: verdict.confidence,
    reasoning: verdict.reasoning,
  };
}

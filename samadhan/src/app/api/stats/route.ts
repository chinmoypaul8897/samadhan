import { getDb } from "@/lib/firebase-admin";
import { computeSlaState } from "@/lib/sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public impact stats (backend-plan C11.1). The transparency layer — honest civic metrics for
// the public dashboard. Computed by a single bounded scan over `issues` (not a denormalised
// stats doc — accurate, no drift, trivially cheap at demo scale). HONESTY GUARD: the headline
// is the resolution RATE + median time-to-resolve, never raw report counts (CLAUDE.md
// anti-pattern). Public route (like /api/health), no auth.

const SCAN_LIMIT = 1000;

type IssueData = {
  status?: string;
  group?: string;
  supporterCount?: number;
  createdAt?: { toMillis(): number };
  verifiedAt?: { toMillis(): number } | null;
  resolvedAt?: { toMillis(): number } | null;
  sla?: { slaHours?: number; deadline?: { toMillis(): number } };
};

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const ACTIVE = new Set([
  "submitted",
  "acknowledged",
  "assigned",
  "in_progress",
  "reopened",
]);

export async function GET() {
  try {
    const db = getDb();
    const snap = await db.collection("issues").limit(SCAN_LIMIT).get();
    const now = Date.now();

    const byStatus: Record<string, number> = {};
    const byGroup: Record<string, number> = {};
    const resolveHours: number[] = [];
    let total = 0;
    let resolvedCount = 0; // verified_resolved
    let citizensHelped = 0;
    let breachedCount = 0; // currently overdue + still active
    let slaResolved = 0; // issues with a resolution timestamp
    let slaMet = 0; // of those, resolved on/before deadline

    for (const doc of snap.docs) {
      const d = doc.data() as IssueData;
      total++;
      const status = d.status ?? "submitted";
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      byGroup[d.group ?? "other"] = (byGroup[d.group ?? "other"] ?? 0) + 1;
      citizensHelped += typeof d.supporterCount === "number" ? d.supporterCount : 0;

      const createdMs = d.createdAt?.toMillis?.();
      const verifiedMs = d.verifiedAt?.toMillis?.();
      if (status === "verified_resolved") {
        resolvedCount++;
        if (createdMs != null && verifiedMs != null && verifiedMs > createdMs) {
          resolveHours.push((verifiedMs - createdMs) / 3600_000);
        }
      }

      const deadlineMs = d.sla?.deadline?.toMillis?.();
      const resolvedMs = d.resolvedAt?.toMillis?.();
      if (deadlineMs != null) {
        if (resolvedMs != null) {
          slaResolved++;
          if (computeSlaState(deadlineMs, d.sla?.slaHours ?? 24, now, resolvedMs) === "met") slaMet++;
        } else if (ACTIVE.has(status) && now > deadlineMs) {
          breachedCount++;
        }
      }
    }

    return Response.json({
      ok: true,
      total,
      resolvedCount,
      resolutionRate: total ? resolvedCount / total : 0,
      medianResolveHours: median(resolveHours),
      slaMetRate: slaResolved ? slaMet / slaResolved : null,
      breachedCount,
      citizensHelped,
      byStatus,
      byGroup,
    });
  } catch (err) {
    console.error("[stats] failed", err);
    return Response.json({ ok: false, error: "STATS_FAILED" }, { status: 500 });
  }
}

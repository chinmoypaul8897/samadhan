import { getDb, getBucket } from "@/lib/firebase-admin";
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
  trackingId?: string;
  title?: string;
  ward?: string | null;
  beforeMedia?: { downloadUrl?: string };
  verification?: { afterMediaPath?: string | null };
  createdAt?: { toMillis(): number };
  verifiedAt?: { toMillis(): number } | null;
  resolvedAt?: { toMillis(): number } | null;
  sla?: { slaHours?: number; deadline?: { toMillis(): number } };
};

type ResolvedItem = {
  trackingId: string;
  title: string;
  group: string;
  beforeUrl: string;
  afterUrl: string;
  resolveHours: number;
  verifiedMs: number;
};

// Token-free public download URL for an issues/** Storage path (mirrors lib/storage.ts
// publicStorageUrl, server-side — issues/** read is public). Used for the after-photo proof.
function publicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media`;
}

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
    const bucketName = getBucket().name;

    const byStatus: Record<string, number> = {};
    const byGroup: Record<string, number> = {};
    const byWard: Record<string, { open: number; breached: number }> = {};
    const resolveHours: number[] = [];
    const resolvedItems: ResolvedItem[] = [];
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
          const hrs = (verifiedMs - createdMs) / 3600_000;
          resolveHours.push(hrs);
          // Recently-resolved proof needs both the before photo and the after proof.
          const beforeUrl = d.beforeMedia?.downloadUrl;
          const afterPath = d.verification?.afterMediaPath;
          if (beforeUrl && afterPath) {
            resolvedItems.push({
              trackingId: d.trackingId ?? "",
              title: d.title ?? "",
              group: d.group ?? "other",
              beforeUrl,
              afterUrl: publicUrl(bucketName, afterPath),
              resolveHours: Math.round(hrs),
              verifiedMs,
            });
          }
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

      // Per-ward open/overdue tally for the "recurring hotspots" insight.
      const ward = (d.ward ?? "").trim();
      if (ward && ACTIVE.has(status)) {
        const w = (byWard[ward] ??= { open: 0, breached: 0 });
        w.open++;
        if (deadlineMs != null && resolvedMs == null && now > deadlineMs) w.breached++;
      }
    }

    // Newest verified fixes first, lean DTO (drop the internal sort key).
    const recentlyResolved = resolvedItems
      .sort((a, b) => b.verifiedMs - a.verifiedMs)
      .slice(0, 6)
      .map((r) => ({
        trackingId: r.trackingId,
        title: r.title,
        group: r.group,
        beforeUrl: r.beforeUrl,
        afterUrl: r.afterUrl,
        resolveHours: r.resolveHours,
      }));

    // Recurring hotspots — wards with the most OPEN issues right now. Descriptive (a live count
    // of where issues cluster), NOT a forecast — we don't fabricate ML "predictions".
    const hotspots = Object.entries(byWard)
      .filter(([, w]) => w.open >= 2)
      .sort((a, b) => b[1].open - a[1].open || b[1].breached - a[1].breached)
      .slice(0, 3)
      .map(([ward, w]) => ({ ward, open: w.open, breached: w.breached }));

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
      hotspots,
      recentlyResolved,
    });
  } catch (err) {
    console.error("[stats] failed", err);
    return Response.json({ ok: false, error: "STATS_FAILED" }, { status: 500 });
  }
}

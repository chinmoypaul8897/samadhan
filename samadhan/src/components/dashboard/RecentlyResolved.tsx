import { BeforeAfter } from "@/components/issue/BeforeAfter";

// Recently-resolved proof strip (frontend-plan §D C11/C12). Real before/after pairs of the
// latest citizen-verified fixes — the dashboard's strongest "from report to resolution" proof.
// Reuses the BeforeAfter media pair. Renders nothing when there are no verified fixes with both
// photos (graceful empty — the rest of the dashboard still stands).

export type ResolvedItem = {
  trackingId: string;
  title: string;
  group: string;
  beforeUrl: string;
  afterUrl: string;
  resolveHours: number;
};

export function RecentlyResolved({ items }: { items: ResolvedItem[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.28px] text-muted">Recently resolved</h2>
      <p className="mt-1 text-[14px] text-muted">
        Real before/after proof — each fix confirmed by the citizen who reported it.
      </p>
      <div className="mt-4 space-y-5">
        {items.slice(0, 3).map((r) => (
          <article key={r.trackingId} className="rounded-lg border border-hairline p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-[14px] text-ink">{r.title || "Civic issue"}</p>
              <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.28px] text-brand">
                fixed in {r.resolveHours}h
              </span>
            </div>
            <BeforeAfter beforeUrl={r.beforeUrl} afterUrl={r.afterUrl} highlightAfter />
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.28px] text-muted">
              {r.trackingId}
              {r.group ? ` · ${r.group}` : ""}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

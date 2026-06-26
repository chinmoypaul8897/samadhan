"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DarkFeatureBand } from "@/components/ui/DarkFeatureBand";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { MapHeatmap } from "@/components/dashboard/MapHeatmap";
import { RecentlyResolved, type ResolvedItem } from "@/components/dashboard/RecentlyResolved";
import { useCountUp } from "@/lib/useCountUp";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// Public impact dashboard (frontend-plan §D C11/C12, the "Learn" surface). Honest headline
// metrics (resolution rate + median time-to-resolve — never raw report counts) over a hotspot
// map, with category/time/ward filters and a recently-resolved before/after proof strip.
type Stats = {
  total: number;
  resolvedCount: number;
  resolutionRate: number;
  medianResolveHours: number | null;
  slaMetRate: number | null;
  breachedCount: number;
  citizensHelped: number;
  byStatus: Record<string, number>;
  byGroup: Record<string, number>;
  recentlyResolved: ResolvedItem[];
};
type GeoP = {
  lat: number;
  lng: number;
  severity: string;
  group: string;
  status: string;
  ward: string | null;
  createdAtMs: number | null;
};

const GROUPS = [
  { key: "all", label: "All" },
  { key: "roads", label: "Roads" },
  { key: "water", label: "Water" },
  { key: "sanitation", label: "Sanitation" },
  { key: "electricity", label: "Power" },
];

const DAY_MS = 86_400_000;
const RANGES = [
  { key: "all", label: "All time", ms: Infinity },
  { key: "30d", label: "30 days", ms: 30 * DAY_MS },
  { key: "7d", label: "7 days", ms: 7 * DAY_MS },
];

const pct = (n: number) => `${Math.round(n)}%`;

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [points, setPoints] = useState<GeoP[] | null>(null);
  const [error, setError] = useState(false);
  const [group, setGroup] = useState("all");
  const [range, setRange] = useState("all");
  const [ward, setWard] = useState("all");
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setError(false);
    try {
      const [s, g] = await Promise.all([
        fetch("/api/stats").then((r) => r.json()),
        fetch("/api/issues/geo").then((r) => r.json()),
      ]);
      if (!s.ok || !g.ok) throw new Error("load failed");
      setStats(s as Stats);
      setPoints(g.points as GeoP[]);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Wards that actually appear in the data (so the filter never offers an empty bucket).
  const wards = useMemo(() => {
    const set = new Set<string>();
    for (const p of points ?? []) if (p.ward) set.add(p.ward);
    return [...set].sort();
  }, [points]);

  const rangeMs = RANGES.find((r) => r.key === range)?.ms ?? Infinity;
  const shownPoints = useMemo(
    () =>
      (points ?? []).filter(
        (p) =>
          (group === "all" || p.group === group) &&
          (ward === "all" || p.ward === ward) &&
          (rangeMs === Infinity || (p.createdAtMs != null && p.createdAtMs >= now - rangeMs)),
      ),
    [points, group, ward, rangeMs, now],
  );

  const rate = stats ? Math.round(stats.resolutionRate * 100) : 0;
  const rateAnim = useCountUp(rate);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero — leads with the resolution RATE (honest headline, never raw counts) */}
      <DarkFeatureBand label="Public impact · Bengaluru">
        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="font-display text-[clamp(3rem,14vw,5.5rem)] font-normal leading-[0.95] tracking-[-0.03em]">
              {stats ? `${Math.round(rateAnim)}%` : "—"}
            </p>
            <p className="mt-1 max-w-sm text-[15px] leading-relaxed text-on-dark/80">
              of reported issues are{" "}
              <span className="text-on-dark">verified fixed</span>
              {stats?.medianResolveHours != null
                ? ` — median ${Math.round(stats.medianResolveHours)}h from report to resolution.`
                : " — from report to resolution."}
            </p>
          </div>
          <Link href="/report" className={buttonClasses("primary", "bg-on-dark text-brand hover:bg-on-dark/90")}>
            Report an issue
          </Link>
        </div>
      </DarkFeatureBand>

      {error ? (
        <ErrorState
          className="mt-6"
          title="Couldn’t load the public stats"
          hint="The figures are live from Firestore — try again in a moment."
          onRetry={() => void load()}
        />
      ) : (
        <>
          {/* Hotspot map + filters (category · time range · ward) */}
          <section className="mt-6">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
              Where issues cluster
            </h2>
            <div className="mt-3 space-y-2">
              <ChipRow label="Category" options={GROUPS} value={group} onSelect={setGroup} />
              <ChipRow label="When" options={RANGES} value={range} onSelect={setRange} />
              {wards.length > 1 ? (
                <ChipRow
                  label="Ward"
                  options={[
                    { key: "all", label: "All wards" },
                    ...wards.map((w) => ({ key: w, label: w })),
                  ]}
                  value={ward}
                  onSelect={setWard}
                />
              ) : null}
            </div>
            <div className="mt-3">
              <MapHeatmap points={shownPoints} />
            </div>
          </section>

          {/* Honest stat grid */}
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard value={rate} format={pct} label="Resolution rate" sublabel="verified fixed / reported" />
            <StatCard
              value={stats?.medianResolveHours ?? 0}
              format={(n) => `${Math.round(n)}h`}
              label="Median time to fix"
              sublabel="report → verified"
              delayMs={60}
            />
            <StatCard
              value={stats ? Math.round((stats.slaMetRate ?? 0) * 100) : 0}
              format={pct}
              label="Resolved on time"
              sublabel="within the SLA"
              delayMs={120}
            />
            <StatCard value={stats?.citizensHelped ?? 0} label="Citizen voices" sublabel="reports + me-toos" delayMs={180} />
            <StatCard value={stats?.total ?? 0} label="Issues tracked" sublabel="across the city" delayMs={240} />
            <StatCard value={stats?.breachedCount ?? 0} label="Now overdue" sublabel="agent escalating" delayMs={300} />
          </section>

          {/* Recently-resolved before/after proof */}
          <RecentlyResolved items={stats?.recentlyResolved ?? []} />

          <p className="mt-8 text-center text-[12px] text-muted">
            Live figures from Samadhan — an autonomous civic resolution agent. From report to resolution.
          </p>
        </>
      )}
    </main>
  );
}

function ChipRow({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.28px] text-muted">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onSelect(o.key)}
          aria-pressed={value === o.key}
          className={cn(
            "inline-flex min-h-11 items-center rounded-xl border px-3 text-[12px] font-medium transition",
            value === o.key
              ? "border-primary bg-primary text-on-dark"
              : "border-hairline text-ink hover:bg-stone",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

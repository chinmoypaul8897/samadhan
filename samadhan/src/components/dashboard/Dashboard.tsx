"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DarkFeatureBand } from "@/components/ui/DarkFeatureBand";
import { StatCard } from "@/components/ui/StatCard";
import { MapHeatmap } from "@/components/dashboard/MapHeatmap";
import { useCountUp } from "@/lib/useCountUp";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// Public impact dashboard (frontend-plan §D C11, the "Learn" surface). Honest headline metrics
// (resolution rate + median time-to-resolve — never raw report counts) over a hotspot map.
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
};
type GeoP = { lat: number; lng: number; severity: string; group: string; status: string };

const GROUPS = [
  { key: "all", label: "All" },
  { key: "roads", label: "Roads" },
  { key: "water", label: "Water" },
  { key: "sanitation", label: "Sanitation" },
  { key: "electricity", label: "Power" },
];

const pct = (n: number) => `${Math.round(n)}%`;

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [points, setPoints] = useState<GeoP[] | null>(null);
  const [error, setError] = useState(false);
  const [group, setGroup] = useState("all");

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  const shownPoints = useMemo(
    () => (points ?? []).filter((p) => group === "all" || p.group === group),
    [points, group],
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
        <Notice>Couldn’t load the public stats right now.</Notice>
      ) : (
        <>
          {/* Hotspot map + category filter */}
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
                Where issues cluster
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {GROUPS.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGroup(g.key)}
                    className={cn(
                      "rounded-xl border px-2.5 py-1 text-[12px] font-medium transition",
                      group === g.key
                        ? "border-primary bg-primary text-on-dark"
                        : "border-hairline text-ink hover:bg-stone",
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <MapHeatmap points={shownPoints} />
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

          <p className="mt-6 text-center text-[12px] text-muted">
            Live figures from Samadhan — an autonomous civic resolution agent. From report to resolution.
          </p>
        </>
      )}
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-md border border-dashed border-hairline px-4 py-10 text-center text-[14px] text-muted">
      {children}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinned } from "lucide-react";
import { loadMaps, BENGALURU, MAP_STYLE } from "@/lib/maps";

// Dashboard hotspot map (frontend-plan §C MapView, C11). A muted Google Map with one
// severity-weighted translucent Circle per public issue — overlaps build a heat-style density
// of where civic pain concentrates. (Circles, not the deprecated visualization.HeatmapLayer.)
// States: loading skeleton / unavailable (no key or load fail → graceful note; the rest of the
// dashboard still renders) / ready (empty is fine).

export type GeoPoint = { lat: number; lng: number; severity: string };

// radius (metres) + fill by severity — bigger/hotter = worse.
const STYLE_BY_SEVERITY: Record<string, { radius: number; color: string; opacity: number }> = {
  high: { radius: 340, color: "#b30000", opacity: 0.4 },
  medium: { radius: 260, color: "#ff7759", opacity: 0.38 },
  low: { radius: 200, color: "#003c33", opacity: 0.32 },
};

export function MapHeatmap({ points }: { points: GeoPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  // Mount: load Maps + create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await loadMaps();
      if (cancelled) return;
      if (!ok || !containerRef.current) {
        setStatus("unavailable");
        return;
      }
      mapRef.current = new google.maps.Map(containerRef.current, {
        center: BENGALURU,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        styles: MAP_STYLE,
        backgroundColor: "#f3f2ee",
        clickableIcons: false,
      });
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
      circlesRef.current.forEach((c) => c.setMap(null));
      circlesRef.current = [];
    };
  }, []);

  // Rebuild the circles when the (filtered) points change.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = points.map((p) => {
      const s = STYLE_BY_SEVERITY[p.severity] ?? STYLE_BY_SEVERITY.medium;
      return new google.maps.Circle({
        map,
        center: { lat: p.lat, lng: p.lng },
        radius: s.radius,
        strokeWeight: 0,
        fillColor: s.color,
        fillOpacity: s.opacity,
        clickable: false,
      });
    });
  }, [points, status]);

  return (
    <div className="relative overflow-hidden rounded-lg border border-hairline bg-stone">
      <div ref={containerRef} className="h-[360px] w-full sm:h-[440px]" aria-label="Issue hotspot map" />
      {status === "loading" ? (
        <div className="absolute inset-0 grid place-items-center bg-stone">
          <div className="size-6 animate-spin rounded-full border-2 border-hairline border-t-brand" />
        </div>
      ) : null}
      {status === "unavailable" ? (
        <div className="absolute inset-0 grid place-items-center bg-stone px-6 text-center">
          <p className="flex flex-col items-center gap-2 text-[13px] text-muted">
            <MapPinned className="size-6" strokeWidth={1.5} />
            The hotspot map couldn’t load here.
          </p>
        </div>
      ) : null}
      {status === "ready" && points.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-canvas/90 px-3 py-1 text-[12px] text-muted shadow-sm">
          No issues in this view yet.
        </div>
      ) : null}
    </div>
  );
}

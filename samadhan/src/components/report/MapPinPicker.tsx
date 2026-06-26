"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X, LoaderCircle } from "lucide-react";
import { loadMaps, BENGALURU, MAP_STYLE } from "@/lib/maps";
import { Button } from "@/components/ui/Button";

// Manual location fallback (frontend-plan §D C2/C12). When GPS is denied/unavailable the citizen
// can still report: a full-screen Google Map (the C11 loader) with a fixed centre pin — drag the
// map under the pin, and we read map.getCenter() on `idle`. Confirms a { lat, lng } back to the
// capture flow, which recomputes the geohash. If Maps can't load (no key) it degrades to a note.

type Picked = { lat: number; lng: number };

export function MapPinPicker({
  initial,
  onConfirm,
  onClose,
}: {
  initial?: Picked;
  onConfirm: (p: Picked) => void;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<Picked>(initial ?? BENGALURU);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await loadMaps();
      if (cancelled) return;
      if (!ok || !mapRef.current) {
        setStatus("unavailable");
        return;
      }
      const map = new google.maps.Map(mapRef.current, {
        center: initial ?? BENGALURU,
        zoom: initial ? 16 : 13,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        styles: MAP_STYLE,
        backgroundColor: "#f3f2ee",
        clickableIcons: false,
      });
      map.addListener("idle", () => {
        const c = map.getCenter();
        if (c) centerRef.current = { lat: c.lat(), lng: c.lng() };
      });
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  // Esc to close + lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
      role="dialog"
      aria-modal="true"
      aria-label="Set the location on the map"
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-[18px] font-normal leading-tight text-ink">Set the location</h2>
          <p className="text-[12px] text-muted">Drag the map so the pin sits on the problem.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition hover:bg-stone hover:text-ink"
        >
          <X className="size-5" strokeWidth={1.5} />
        </button>
      </header>

      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />

        {status === "ready" ? (
          // Fixed centre pin — its tip points at the map centre (nudged up by ~half its height).
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <MapPin
              className="size-10 -translate-y-4 text-brand drop-shadow-md"
              strokeWidth={2.25}
              aria-hidden
            />
          </div>
        ) : null}

        {status === "loading" ? (
          <div className="absolute inset-0 grid place-items-center bg-stone/50 text-muted">
            <LoaderCircle className="size-6 animate-spin" strokeWidth={1.5} />
          </div>
        ) : null}

        {status === "unavailable" ? (
          <div className="absolute inset-0 grid place-items-center bg-stone px-8 text-center text-[14px] text-muted">
            The map couldn’t load here. Enable location access and use “Retry location” instead.
          </div>
        ) : null}
      </div>

      <div className="border-t border-hairline px-4 py-3">
        <Button
          variant="brand"
          className="w-full"
          disabled={status !== "ready"}
          onClick={() => onConfirm(centerRef.current)}
        >
          Use this location
        </Button>
      </div>
    </div>
  );
}

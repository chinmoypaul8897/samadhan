"use client";

import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

// Google Maps JavaScript API loader (C11). v2 functional API (setOptions + importLibrary).
// The browser key (NEXT_PUBLIC_MAPS_BROWSER_KEY) is referrer-restricted and allowed to call the
// Maps JS + Static Maps APIs (C11b key update). importLibrary("maps") bootstraps the global
// google.maps.* classes (Map/Circle/LatLng — all stable, non-deprecated). We render hotspots
// with weighted Circles rather than the deprecated visualization.HeatmapLayer (end-of-life in
// 2026; the @types stub it). Bindings: developers.google.com/maps/documentation/javascript.

const KEY = process.env.NEXT_PUBLIC_MAPS_BROWSER_KEY;

let configured = false;
function ensureConfigured(): boolean {
  if (!KEY) return false;
  if (!configured) {
    setOptions({ key: KEY, v: "weekly" });
    configured = true;
  }
  return true;
}

/** Ensure the Maps JS API is loaded (globals available). Returns false if no key / load fails. */
export async function loadMaps(): Promise<boolean> {
  if (!ensureConfigured()) return false;
  try {
    await importLibrary("maps"); // bootstraps global google.maps.* (Map, Circle, LatLng, …)
    return true;
  } catch (err) {
    console.error("[maps] load failed", err);
    return false;
  }
}

/** Bengaluru — the demo city (data-shapes §4). */
export const BENGALURU = { lat: 12.9716, lng: 77.5946 };

// Muted, canvas-matching map style (frontend-plan §C MapView). Desaturated, POIs hidden,
// soft roads/water — the heat layer carries the colour.
export const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f3f2ee" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#93939f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#d9d9dd" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dfe8ea" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eeece7" }] },
];

import {
  geohashForLocation,
  geohashQueryBounds,
  distanceBetween,
  type Geopoint,
} from "geofire-common";

// Re-exports per backend-plan.md A.6. geohashForLocation → 10-char hash (geofire
// default precision); distanceBetween returns KILOMETRES, so ×1000 for metres.
export { geohashQueryBounds, type Geopoint };

/** 10-character geohash for a [lat, lng] pair. */
export function geohashOf(lat: number, lng: number): string {
  return geohashForLocation([lat, lng]);
}

/** Distance in METRES between two [lat, lng] points (geofire km × 1000). */
export function distanceMeters(a: Geopoint, b: Geopoint): number {
  return distanceBetween(a, b) * 1000;
}

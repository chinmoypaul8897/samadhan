import "server-only";

// Reverse-geocode the citizen's GPS pin (Google Geocoding API, server-side key).
// Verified bindings: match address_components by types[] (never index); ward proxy =
// sublocality_level_1 → sublocality_level_2 → neighborhood (NOT the BBMP civic ward).
// NEVER throws — any non-OK status degrades to "(approx) lat,lng" so issue creation
// is never blocked (backend-plan C4 error/edge).
export type LocateResult = {
  addressString: string;
  ward: string | null;
  zone: string | null;
  city: string | null;
  zipcode: string | null;
  geocodeStatus: string;
};

type Component = { long_name: string; short_name: string; types: string[] };

export async function locate(lat: number, lng: number): Promise<LocateResult> {
  const approx = `(approx) ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const empty = (geocodeStatus: string): LocateResult => ({
    addressString: approx,
    ward: null,
    zone: null,
    city: null,
    zipcode: null,
    geocodeStatus,
  });

  const key = process.env.MAPS_SERVER_KEY;
  if (!key) return empty("NO_KEY");

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=en&region=in`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results?: { formatted_address?: string; address_components?: Component[] }[];
    };
    if (data.status !== "OK" || !data.results?.length) return empty(data.status ?? "ERROR");

    const comps = data.results[0].address_components ?? [];
    const get = (t: string) => comps.find((c) => c.types.includes(t))?.long_name ?? null;
    return {
      addressString: data.results[0].formatted_address ?? approx,
      city: get("locality"),
      zipcode: get("postal_code"),
      zone: get("administrative_area_level_2"),
      ward:
        get("sublocality_level_1") ?? get("sublocality_level_2") ?? get("neighborhood"),
      geocodeStatus: "OK",
    };
  } catch (err) {
    console.error("[locate] geocode failed", err);
    return empty("EXCEPTION");
  }
}

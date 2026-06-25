import { MapPin } from "lucide-react";

// Google Maps Static API thumbnail (browser key). Tolerates a missing key — renders a
// labelled placeholder so a key-creation hiccup can't block the page. The interactive
// MapView (pan/zoom/clusters) lands at the C11 dashboard heatmap.
export function StaticMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label?: string;
}) {
  const key = process.env.NEXT_PUBLIC_MAPS_BROWSER_KEY;
  if (!key) {
    return (
      <div className="flex aspect-[2/1] w-full items-center justify-center gap-2 rounded-md border border-hairline bg-stone text-[13px] text-muted">
        <MapPin className="size-4" strokeWidth={1.5} />
        {label ?? "Location on map"}
      </div>
    );
  }
  const marker = `color:0x003c33%7C${lat},${lng}`;
  const src = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x300&scale=2&markers=${marker}&key=${key}`;
  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={label ?? "Map of the issue location"}
        className="aspect-[2/1] w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

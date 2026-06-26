import { cn } from "@/lib/cn";

// BeforeAfter (frontend-plan §C, DESIGN hero-photo-card pair). Two labelled lg-radius media
// cards — the reported photo and the officer's proof-of-fix. When `afterUrl` is absent it
// renders the before alone (still the seed photo). Reused on the officer detail + the citizen
// VerifyCard. Side-by-side from sm; stacked on small phones.
export function BeforeAfter({
  beforeUrl,
  afterUrl,
  beforeLabel = "Reported",
  afterLabel = "After the fix",
  highlightAfter = false,
}: {
  beforeUrl: string;
  afterUrl?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  highlightAfter?: boolean;
}) {
  return (
    <div className={cn("grid gap-3", afterUrl ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
      <Frame url={beforeUrl} label={beforeLabel} />
      {afterUrl ? (
        <Frame url={afterUrl} label={afterLabel} tone={highlightAfter ? "brand" : "default"} />
      ) : null}
    </div>
  );
}

function Frame({
  url,
  label,
  tone = "default",
}: {
  url: string;
  label: string;
  tone?: "default" | "brand";
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-lg border bg-stone",
        tone === "brand" ? "border-brand/30" : "border-hairline",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="aspect-[4/3] w-full object-cover" />
      <figcaption
        className={cn(
          "px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.28px]",
          tone === "brand" ? "text-brand" : "text-muted",
        )}
      >
        {label}
      </figcaption>
    </figure>
  );
}

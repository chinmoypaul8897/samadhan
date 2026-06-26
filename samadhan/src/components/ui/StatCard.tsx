"use client";

import { useCountUp } from "@/lib/useCountUp";
import { cn } from "@/lib/cn";

// StatCard (frontend-plan §C, DESIGN research-table/capability-card). A big mono number that
// counts up + a label. `light` on canvas, `dark` on the deep-green band.
export function StatCard({
  value,
  label,
  sublabel,
  format,
  tone = "light",
  delayMs = 0,
}: {
  value: number;
  label: string;
  sublabel?: string;
  format?: (n: number) => string;
  tone?: "light" | "dark";
  delayMs?: number;
}) {
  const n = useCountUp(value);
  const display = format ? format(n) : Math.round(n).toLocaleString("en-IN");

  return (
    <div
      className={cn(
        "animate-fade-up rounded-md border p-5",
        tone === "dark" ? "border-on-dark/15 bg-on-dark/5" : "border-hairline bg-canvas",
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <p
        className={cn(
          "font-mono text-[28px] leading-none sm:text-[32px]",
          tone === "dark" ? "text-on-dark" : "text-ink",
        )}
      >
        {display}
      </p>
      <p className={cn("mt-1.5 text-[13px]", tone === "dark" ? "text-on-dark/75" : "text-muted")}>
        {label}
      </p>
      {sublabel ? (
        <p className={cn("text-[12px]", tone === "dark" ? "text-on-dark/55" : "text-muted/80")}>
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// DarkFeatureBand (frontend-plan §C, DESIGN dark-feature-band). The deep-green hero band —
// a mono label, a display title, and freeform children. Used by the dashboard hero + the
// officer queue header.
export function DarkFeatureBand({
  label,
  title,
  children,
  className,
}: {
  label?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg bg-brand px-6 py-7 text-on-dark sm:px-8 sm:py-9", className)}>
      {label ? (
        <p className="font-mono text-[12px] uppercase tracking-[0.28px] text-on-dark/70">{label}</p>
      ) : null}
      {title ? (
        <h1 className="mt-1 font-display text-[26px] font-normal leading-tight tracking-[-0.01em] sm:text-[34px]">
          {title}
        </h1>
      ) : null}
      {children}
    </section>
  );
}

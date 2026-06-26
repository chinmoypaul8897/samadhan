"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";

// Shared error-state primitive (frontend-plan §C, C12). Same flat shell as EmptyState, with an
// AlertTriangle and an optional Retry — so a failed fetch is never a dead end, it always offers
// a way forward. Used by the dashboard, officer queue, my-reports, category grid, etc.

export function ErrorState({
  title = "Couldn’t load this",
  hint,
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-hairline px-6 py-14 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-7 text-muted" strokeWidth={1.5} aria-hidden />
      <p className="mt-4 font-sans text-[15px] text-ink">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-[13px] text-muted">{hint}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-hairline px-5 py-2.5 text-[14px] font-medium text-ink transition hover:bg-stone active:scale-[0.97]"
        >
          <RefreshCw className="size-4" strokeWidth={1.75} /> {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

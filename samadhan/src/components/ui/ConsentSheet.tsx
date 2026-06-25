"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// Reusable one-tap consent sheet (frontend-plan §C `ConsentSheet` → contact-form-card).
// A rounded white panel that slides up over a scrim — used for the C6 file gate and reused
// by C9 (verify) and C10 (escalate). Body content + a sticky footer (the consent CTA).
// Honours prefers-reduced-motion via globals.css. Esc + scrim-click + close-X all dismiss.
export function ConsentSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
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
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-scrim-in absolute inset-0 bg-primary/40"
      />
      <div className="animate-sheet-up relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-lg border border-hairline bg-canvas shadow-xl sm:rounded-lg">
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-[18px] font-normal leading-tight text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-full p-1.5 text-muted transition hover:bg-stone hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        <div className="border-t border-hairline bg-canvas px-5 py-4">{footer}</div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/Button";

// Public dashboard shell (frontend-plan §B). A standalone, shareable public page — minimal
// header (wordmark + Report CTA), no citizen bottom-nav.
export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="font-display text-lg tracking-[-0.01em] text-brand">
            Samadhan
          </Link>
          <Link href="/report" className={buttonClasses("brand", "px-4 py-2 text-[13px]")}>
            Report an issue
          </Link>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}

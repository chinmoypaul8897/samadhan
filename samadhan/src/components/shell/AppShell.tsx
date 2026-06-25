"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

// Wraps citizen surfaces in the top bar + bottom nav. The capture flow (/report,
// C2) runs full-focus, so the chrome hides there.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullFocus = pathname.startsWith("/report");

  return (
    <>
      {!fullFocus && <TopBar />}
      <div className="flex flex-1 flex-col">{children}</div>
      {!fullFocus && <BottomNav />}
    </>
  );
}

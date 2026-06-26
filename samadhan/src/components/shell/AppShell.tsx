"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { OfficerShell } from "@/components/officer/OfficerShell";

// Wraps citizen surfaces in the top bar + bottom nav. The capture flow (/report,
// C2) runs full-focus; the officer portal (/officer, C8) uses its own denser shell.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullFocus = pathname.startsWith("/report");
  const officer = pathname.startsWith("/officer");

  if (officer) return <OfficerShell>{children}</OfficerShell>;

  return (
    <>
      {!fullFocus && <TopBar />}
      <div className="flex flex-1 flex-col">{children}</div>
      {!fullFocus && <BottomNav />}
    </>
  );
}

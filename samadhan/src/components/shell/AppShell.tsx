"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { OfficerShell } from "@/components/officer/OfficerShell";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

// Wraps citizen surfaces in the top bar + bottom nav. The capture flow (/report, C2) runs
// full-focus; the officer portal (/officer, C8) + the public dashboard (/dashboard, C11) use
// their own shells.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fullFocus = pathname.startsWith("/report");
  const officer = pathname.startsWith("/officer");
  const dashboard = pathname.startsWith("/dashboard");

  if (officer) return <OfficerShell>{children}</OfficerShell>;
  if (dashboard) return <DashboardShell>{children}</DashboardShell>;

  return (
    <>
      {!fullFocus && <TopBar />}
      <div className="flex flex-1 flex-col">{children}</div>
      {!fullFocus && <BottomNav />}
    </>
  );
}

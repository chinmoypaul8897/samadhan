"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart3, ClipboardList, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Bottom nav: Home · Impact (public dashboard) · Report (prominent + labelled) · Activity.
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 border-t border-hairline bg-canvas/95 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-4 items-center px-4">
        <NavItem href="/" label="Home" icon={Home} active={pathname === "/"} />
        <NavItem
          href="/dashboard"
          label="Impact"
          icon={BarChart3}
          active={pathname.startsWith("/dashboard")}
        />

        <Link
          href="/report"
          aria-label="Report an issue"
          aria-current={pathname.startsWith("/report") ? "page" : undefined}
          className="flex flex-col items-center gap-0.5"
        >
          <span className="grid size-10 place-items-center rounded-full bg-brand text-on-dark shadow-md shadow-brand/25 transition active:scale-95">
            <Plus className="size-5" strokeWidth={2.5} />
          </span>
          <span className="text-[11px] font-medium text-brand">Report</span>
        </Link>

        <NavItem
          href="/me"
          label="Activity"
          icon={ClipboardList}
          active={pathname.startsWith("/me")}
        />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-0.5 text-[11px] transition",
        active ? "text-brand" : "text-muted hover:text-ink",
      )}
    >
      <Icon className="size-5" strokeWidth={1.5} />
      {label}
    </Link>
  );
}

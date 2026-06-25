"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Plus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Three-zone bottom nav: Home · Report FAB (the one shadowed element) · Activity.
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 border-t border-hairline bg-canvas/95 backdrop-blur">
      <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-3 items-center px-6">
        <NavItem href="/" label="Home" icon={Home} active={pathname === "/"} />

        <div className="flex justify-center">
          <Link
            href="/report"
            aria-label="Report an issue"
            className="grid size-14 -translate-y-3 place-items-center rounded-full bg-brand text-on-dark shadow-lg shadow-brand/30 transition active:scale-95"
          >
            <Plus className="size-7" strokeWidth={2} />
          </Link>
        </div>

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

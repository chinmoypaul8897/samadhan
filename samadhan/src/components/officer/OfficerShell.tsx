"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

// Officer portal shell (frontend-plan §D C8) — denser, desktop-leaning. Slim sticky header
// (wordmark · authority/department · officer name · sign out), white canvas, no citizen
// bottom-nav/FAB. Shown only when signed in as staff (the page gates the body).
const AUTHORITY_NAME: Record<string, string> = {
  bbmp: "BBMP",
  bwssb: "BWSSB",
  bescom: "BESCOM",
};

export function OfficerShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const isStaff = profile?.role === "officer" || profile?.role === "admin";
  const authority =
    profile?.authorityId ? AUTHORITY_NAME[profile.authorityId] ?? profile.authorityId : null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Link href="/officer" className="font-display text-lg tracking-[-0.01em] text-brand">
              Samadhan
            </Link>
            <span className="hidden rounded-full bg-stone px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.28px] text-ink/70 sm:inline">
              Officer
            </span>
            {authority ? (
              <span className="text-[13px] text-muted">
                {authority}
                {profile?.department ? ` · ${profile.department}` : ""}
              </span>
            ) : profile?.role === "admin" ? (
              <span className="text-[13px] text-muted">Admin</span>
            ) : null}
          </div>

          {isStaff ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-[13px] text-ink sm:inline">{profile?.displayName}</span>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-stone hover:text-ink"
              >
                <LogOut className="size-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}

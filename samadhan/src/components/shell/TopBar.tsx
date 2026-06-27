"use client";

import Link from "next/link";
import { useState } from "react";
import { User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// Citizen top bar: wordmark · profile. The whole product runs on anonymous auth; phone-OTP
// sign-in (save reports across devices) is on the roadmap, so the profile menu carries no
// upgrade action — no dead clicks. (The complaint language is auto-detected from the citizen's
// voice/text, so there's no manual language control here either.)
export function TopBar() {
  const { profile, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = profile?.displayName ?? "Anonymous Citizen";
  const isAnon = profile?.isAnonymous !== false; // true while loading / anonymous
  const phone = profile?.phone;

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <Link
          href="/"
          className="font-display text-lg tracking-[-0.01em] text-brand"
        >
          Samadhan
        </Link>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              aria-label="Profile"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="grid size-11 place-items-center rounded-full text-muted transition hover:bg-stone hover:text-ink"
            >
              <UserIcon className="size-5" strokeWidth={1.5} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-11 w-60 rounded-md border border-hairline bg-canvas p-3 shadow-lg"
              >
                <p className="font-sans text-sm text-ink">{name}</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {loading
                    ? "Signing in…"
                    : isAnon
                      ? "Signed in anonymously"
                      : `Signed in${phone ? ` · ${phone}` : ""}`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { LanguageToggle } from "./LanguageToggle";

// Citizen top bar: wordmark · language toggle · notifications · profile.
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
          <LanguageToggle />
          <button
            type="button"
            aria-label="Notifications"
            className="grid size-11 place-items-center rounded-full text-muted transition hover:bg-stone hover:text-ink"
          >
            <Bell className="size-5" strokeWidth={1.5} />
          </button>

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
                {isAnon ? (
                  <>
                    <button
                      type="button"
                      disabled
                      className="mt-3 w-full cursor-not-allowed rounded-sm border border-hairline px-3 py-2 text-left text-[13px] text-ink opacity-70"
                    >
                      Save your reports
                    </button>
                    {/* C13: phone-OTP upgrade is built (PhoneUpgradeSheet + auth-context
                        startPhoneUpgrade/confirmPhoneOtp) but its entry is deferred — phone auth
                        needs a provisioned reCAPTCHA Enterprise web key (Identity Platform
                        managed config); re-enable by opening the sheet here once that's set up. */}
                    <p className="mt-1 text-[11px] text-muted">Phone sign-in arrives soon.</p>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

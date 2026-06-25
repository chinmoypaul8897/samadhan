"use client";

import { useAuth, type LanguagePref } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

const OPTIONS: { value: LanguagePref; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "hi", label: "हि" },
];

// EN/हि segmented pill (DESIGN.md button-pill-outline). Persists languagePref to
// users/{uid}; full i18n string swap lands in C13.
export function LanguageToggle() {
  const { profile, setLanguage } = useAuth();
  const active = profile?.languagePref ?? "en";

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center rounded-pill border border-hairline p-0.5"
    >
      {OPTIONS.map((o) => {
        const isActive = o.value === active;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setLanguage(o.value)}
            aria-pressed={isActive}
            className={cn(
              "rounded-pill px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.28px] transition",
              isActive ? "bg-primary text-on-dark" : "text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

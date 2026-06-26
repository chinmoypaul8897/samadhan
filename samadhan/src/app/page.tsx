import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { CategoryGrid } from "@/components/home/CategoryGrid";

// Citizen home (inside the app shell). The C0 marketing hero folds into the
// public dashboard at C11; here the home is the in-app entry point.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <section className="animate-fade-up">
        <p className="font-mono text-[13px] uppercase tracking-[0.28px] text-brand">
          Civic Resolution Agent
        </p>
        <h1 className="mt-3 font-display text-[clamp(1.9rem,7vw,2.6rem)] font-normal leading-[1.05] tracking-[-0.02em] text-ink">
          See it. Snap it.
          <br />
          We get it fixed.
        </h1>
        <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-slate">
          Report a civic problem and an autonomous agent files it with the right
          authority, tracks the SLA, and proves the fix — from report to
          resolution.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/report" className={buttonClasses("brand")}>
            Report an issue
          </Link>
          <Link
            href="/dashboard"
            className="text-[14px] text-ink underline underline-offset-4 transition hover:text-link"
          >
            See the public impact →
          </Link>
        </div>
      </section>

      <section
        className="animate-fade-up mt-12"
        style={{ animationDelay: "120ms" }}
      >
        <h2 className="font-display text-[20px] font-normal tracking-[-0.01em] text-ink">
          What can you report?
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          Pick a category, or just snap a photo — the agent figures out the rest.
        </p>
        <div className="mt-4">
          <CategoryGrid />
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

const PIPELINE = ["Perceive", "Locate", "De-duplicate", "Route", "File", "Verify"];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p
          className="animate-fade-up font-mono text-[13px] uppercase tracking-[0.28px] text-brand"
          style={{ animationDelay: "0ms" }}
        >
          Civic Resolution Agent
        </p>

        <h1
          className="animate-fade-up mt-5 font-display text-[clamp(2.5rem,9vw,5.5rem)] font-normal leading-[1.02] tracking-[-0.02em] text-ink"
          style={{ animationDelay: "80ms" }}
        >
          Samadhan
        </h1>

        <p
          className="animate-fade-up mt-5 max-w-xl text-pretty text-lg leading-relaxed text-slate"
          style={{ animationDelay: "160ms" }}
        >
          Everyone built the report button. We built the agent that makes sure it
          actually gets fixed — and proves it.
        </p>

        <div
          className="animate-fade-up mt-9 flex flex-col items-center gap-4 sm:flex-row"
          style={{ animationDelay: "240ms" }}
        >
          <Link href="/report" className={buttonClasses("brand")}>
            Report an issue
          </Link>
          <a
            href="https://github.com/chinmoypaul8897/samadhan"
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("text")}
          >
            View the build
          </a>
        </div>

        <ul
          className="animate-fade-up mt-14 flex flex-wrap items-center justify-center gap-2"
          style={{ animationDelay: "320ms" }}
        >
          {PIPELINE.map((step) => (
            <li
              key={step}
              className="rounded-pill border border-hairline px-3 py-1 font-mono text-[12px] uppercase tracking-[0.28px] text-muted"
            >
              {step}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-hairline px-6 py-6 text-center text-[13px] text-muted">
        From report to resolution · Built on Google Cloud for Vibe2Ship
      </footer>
    </main>
  );
}

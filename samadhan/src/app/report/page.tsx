import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

// Placeholder so the landing CTA is never a dead end. Replaced by the real
// capture flow in Chunk 2 (frontend-plan §D C2).
export default function ReportPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="font-mono text-[13px] uppercase tracking-[0.28px] text-brand">
        Capture
      </p>
      <h1 className="mt-4 font-display text-3xl leading-tight text-ink">
        Reporting flow — arriving next
      </h1>
      <p className="mt-3 max-w-md text-slate">
        Snap a photo and the agent classifies, locates, de-duplicates, routes and
        files it for you. We&apos;re building this step in the next chunk.
      </p>
      <Link href="/" className={buttonClasses("outline", "mt-8")}>
        Back home
      </Link>
    </main>
  );
}

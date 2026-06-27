"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { useIssue } from "@/lib/issues";
import { buttonClasses } from "@/components/ui/Button";

// Standout #1 — the dedup payoff. A linked report lands here instead of a fresh-issue
// header: the agent merged it into an existing case and amplified the count. Subscribes
// to the live issue so the supporter number is real, and counts up to it.
function useCountUp(target: number, durationMs = 900): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setN(0);
      return;
    }
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return n;
}

export function MergeCelebration({ issueId }: { issueId: string }) {
  const { issue, error } = useIssue(issueId);
  const loaded = issue !== undefined && issue !== null;
  const failed = error || issue === null; // read error / missing doc → don't spin forever
  // "N citizens ALREADY reported this" = everyone before you → supporterCount − 1.
  const others = loaded ? Math.max((issue.supporterCount ?? 1) - 1, 1) : 0;
  const display = useCountUp(others);

  return (
    <div className="mt-5 animate-pop-in rounded-lg border border-brand/20 bg-wash-green p-6 text-center">
      <span className="mx-auto flex size-12 animate-ring-pulse items-center justify-center rounded-full bg-brand text-on-dark">
        <Users className="size-6" strokeWidth={1.5} />
      </span>
      <h1 className="mt-4 font-display text-[22px] font-normal leading-tight tracking-[-0.01em] text-brand">
        {loaded ? (
          <>
            <span className="tabular-nums">{display}</span>{" "}
            {others === 1 ? "citizen has" : "citizens have"} already reported this
          </>
        ) : failed ? (
          "Linked to an existing report"
        ) : (
          "Matching your report…"
        )}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink/75">
        Your photo adds weight. We’ve linked it to the issue others are already tracking —
        so the agent chases one strong case, not fifty silent ones.
      </p>
      <Link
        href={`/issue/${issueId}`}
        className={buttonClasses("brand", "mt-5 w-full justify-center")}
      >
        View the issue
        <ArrowRight className="size-4" strokeWidth={1.5} />
      </Link>
    </div>
  );
}

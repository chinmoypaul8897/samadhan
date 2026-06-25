"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { computeSlaState, formatRemaining } from "@/lib/sla";
import type { IssueDoc } from "@/lib/issues";

// SLA breach banner (frontend-plan §D C7). Client-computed from the live deadline — the
// scheduled breach sweep + escalation push is C10. Shows only on an active (unresolved)
// issue once now > deadline. Mounted-gated to avoid SSR/hydration mismatch.
const ACTIVE = new Set(["submitted", "acknowledged", "assigned", "in_progress", "reopened"]);

export function BreachBanner({ issue }: { issue: IssueDoc }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  if (now === null || !ACTIVE.has(issue.status)) return null;

  const deadlineMs = issue.sla.deadline.toMillis();
  const state = computeSlaState(deadlineMs, issue.sla.slaHours, now, issue.resolvedAt?.toMillis() ?? null);
  if (state !== "breached") return null;

  const overdue = formatRemaining(deadlineMs, now).replace(/^Breached by\s*/i, "");

  return (
    <div className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger/5 px-3.5 py-3 text-[13px] text-danger">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <div>
        <p className="font-medium">SLA breached — overdue by {overdue}.</p>
        <p className="text-danger/80">An escalation will be drafted to the authority automatically.</p>
      </div>
    </div>
  );
}

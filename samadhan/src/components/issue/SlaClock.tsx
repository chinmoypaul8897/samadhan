"use client";

import { useEffect, useState } from "react";
import type { Timestamp } from "firebase/firestore";
import { computeSlaState, formatRemaining, type SlaState } from "@/lib/sla";
import { cn } from "@/lib/cn";

// Live SLA countdown (frontend-plan slaTick). Colour is computed CLIENT-side from the
// deadline each second — the stored sla.state is only the creation snapshot.
const TONE: Record<SlaState, string> = {
  on_track: "text-brand",
  due_soon: "text-accent",
  breached: "text-danger",
  met: "text-brand",
};
const NOTE: Record<SlaState, string> = {
  on_track: "within SLA",
  due_soon: "due soon",
  breached: "SLA breached",
  met: "resolved in time",
};

export function SlaClock({
  deadline,
  slaHours,
  resolvedAt,
  closed = false,
}: {
  deadline: Timestamp;
  slaHours: number;
  resolvedAt?: Timestamp | null;
  closed?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (resolvedAt || closed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resolvedAt, closed]);

  // Terminal "cannot fix" issues never get a resolution time, so the live clock would otherwise
  // read a contradictory red "SLA breached" beside the muted "Can't fix" chip. Show a neutral
  // closed state instead — the issue was referred out, not missed.
  if (closed) {
    return (
      <div className="rounded-md border border-hairline bg-canvas p-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.28px] text-muted">SLA clock</p>
        <div className="mt-1 flex items-baseline gap-2 text-muted">
          <span className="font-mono text-[28px] tabular-nums tracking-tight">Closed</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.28px]">unable to resolve</span>
        </div>
        <p className="mt-1 text-[12px] text-muted">Referred outside this authority’s remit.</p>
      </div>
    );
  }

  const deadlineMs = deadline.toMillis();
  const resolvedMs = resolvedAt ? resolvedAt.toMillis() : null;
  const state = computeSlaState(deadlineMs, slaHours, now, resolvedMs);

  return (
    <div className="rounded-md border border-hairline bg-canvas p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.28px] text-muted">SLA clock</p>
      <div className={cn("mt-1 flex items-baseline gap-2", TONE[state], state === "due_soon" && "animate-pulse")}>
        <span className="font-mono text-[28px] tabular-nums tracking-tight">
          {/* Resolved issues freeze the clock at the resolution moment — measure the
              margin against the deadline then, not a live "breached by" against now. */}
          {formatRemaining(deadlineMs, resolvedMs ?? now)}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.28px]">{NOTE[state]}</span>
      </div>
      <p className="mt-1 text-[12px] text-muted">{slaHours}h resolution target</p>
    </div>
  );
}

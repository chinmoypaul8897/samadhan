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
}: {
  deadline: Timestamp;
  slaHours: number;
  resolvedAt?: Timestamp | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (resolvedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resolvedAt]);

  const deadlineMs = deadline.toMillis();
  const resolvedMs = resolvedAt ? resolvedAt.toMillis() : null;
  const state = computeSlaState(deadlineMs, slaHours, now, resolvedMs);

  return (
    <div className="rounded-md border border-hairline bg-canvas p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.28px] text-muted">SLA clock</p>
      <div className={cn("mt-1 flex items-baseline gap-2", TONE[state], state === "due_soon" && "animate-pulse")}>
        <span className="font-mono text-[28px] tabular-nums tracking-tight">
          {formatRemaining(deadlineMs, now)}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.28px]">{NOTE[state]}</span>
      </div>
      <p className="mt-1 text-[12px] text-muted">{slaHours}h resolution target</p>
    </div>
  );
}

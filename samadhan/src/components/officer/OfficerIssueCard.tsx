"use client";

import Link from "next/link";
import { Users, TriangleAlert, ChevronRight } from "lucide-react";
import type { QueueIssue } from "@/lib/officer-api";
import { computeSlaState, formatRemaining } from "@/lib/sla";
import { StatusChip } from "@/components/issue/StatusChip";
import { cn } from "@/lib/cn";

// Officer queue row (frontend-plan §C IssueCard, product-card/stone). Support count is the
// visual lever. Compact SLA chip is colour-coded from the live deadline.
const SLA_TONE: Record<string, string> = {
  on_track: "bg-brand/10 text-brand",
  due_soon: "bg-accent/15 text-accent",
  breached: "bg-danger/10 text-danger",
  met: "bg-brand/10 text-brand",
};

export function OfficerIssueCard({ issue, now }: { issue: QueueIssue; now: number }) {
  const slaState =
    issue.deadlineMs != null
      ? computeSlaState(issue.deadlineMs, issue.slaHours, now)
      : null;

  return (
    <Link
      href={`/officer/issue/${issue.id}`}
      className="group flex items-stretch gap-3 rounded-md border border-hairline bg-canvas p-3 transition hover:border-brand/30 hover:bg-stone/40"
    >
      <div className="size-16 shrink-0 overflow-hidden rounded-sm bg-stone sm:size-20">
        {issue.beforeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={issue.beforeUrl} alt="" className="size-full object-cover" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-medium text-ink">{issue.title}</h3>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[12px] font-medium text-brand">
            <Users className="size-3.5" strokeWidth={1.75} />
            {issue.supporterCount}
          </span>
        </div>

        <p className="mt-0.5 truncate text-[12px] text-muted">
          {issue.addressString}
          {issue.ward ? ` · ${issue.ward}` : ""}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusChip status={issue.status} />
          {slaState ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
                SLA_TONE[slaState] ?? "bg-stone text-ink",
              )}
            >
              {formatRemaining(issue.deadlineMs as number, now)}
            </span>
          ) : null}
          {issue.hazard ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
              <TriangleAlert className="size-3" strokeWidth={1.75} /> Hazard
            </span>
          ) : null}
        </div>
      </div>

      <ChevronRight
        className="my-auto size-4 shrink-0 text-muted transition group-hover:text-ink"
        strokeWidth={1.5}
      />
    </Link>
  );
}

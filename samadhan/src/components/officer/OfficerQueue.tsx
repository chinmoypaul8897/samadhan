"use client";

import { useEffect, useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import { fetchQueue, type QueueIssue } from "@/lib/officer-api";
import { OfficerIssueCard } from "./OfficerIssueCard";
import { DarkFeatureBand } from "@/components/ui/DarkFeatureBand";
import { cn } from "@/lib/cn";

// Officer queue (frontend-plan §D C8). DarkFeatureBand header with counts, then the
// support-sorted list. Lightweight client-side status filter. The server already sorts by
// supporterCount desc; we only group for the chips.
const AUTHORITY_NAME: Record<string, string> = {
  bbmp: "Bruhat Bengaluru Mahanagara Palike",
  bwssb: "Bangalore Water Supply & Sewerage Board",
  bescom: "Bangalore Electricity Supply Company",
};

type Filter = { key: string; label: string; match: (s: string) => boolean };
const FILTERS: Filter[] = [
  { key: "all", label: "All", match: () => true },
  { key: "new", label: "New", match: (s) => s === "submitted" || s === "reopened" },
  {
    key: "active",
    label: "In progress",
    match: (s) => s === "acknowledged" || s === "assigned" || s === "in_progress",
  },
  {
    key: "await",
    label: "Awaiting confirm",
    match: (s) => s === "resolved_pending_verification",
  },
];

export function OfficerQueue() {
  const [issues, setIssues] = useState<QueueIssue[] | null>(null);
  const [authorityId, setAuthorityId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [now] = useState(() => Date.now());

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await fetchQueue();
      setIssues(res.issues);
      setAuthorityId(res.authority.id);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = (issues ?? []).filter((i) => active.match(i.status));
  const authorityName = authorityId ? AUTHORITY_NAME[authorityId] ?? authorityId : "All authorities";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <DarkFeatureBand label="Resolution queue" title={authorityName}>
        <div className="mt-4 flex items-center gap-6">
          <div>
            <p className="font-mono text-[28px] leading-none">{issues?.length ?? "—"}</p>
            <p className="mt-1 text-[12px] text-on-dark/70">Open issues</p>
          </div>
          <div className="h-9 w-px bg-on-dark/15" />
          <p className="max-w-xs text-[13px] leading-relaxed text-on-dark/80">
            Sorted by how many citizens are affected. Clear the top first.
          </p>
        </div>
      </DarkFeatureBand>

      {/* Filters + refresh */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-[13px] font-medium transition",
                filter === f.key
                  ? "border-primary bg-primary text-on-dark"
                  : "border-hairline text-ink hover:bg-stone",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-stone hover:text-ink"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} strokeWidth={1.5} />
        </button>
      </div>

      {/* List / states */}
      <div className="mt-4">
        {error ? (
          <Notice>Couldn’t load the queue. Tap refresh to try again.</Notice>
        ) : issues === null ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-md bg-stone" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <Notice>
            <Inbox className="mx-auto mb-2 size-6 text-muted" strokeWidth={1.5} />
            {issues.length === 0
              ? "No open issues for your authority right now."
              : "Nothing in this filter."}
          </Notice>
        ) : (
          <ul className="space-y-2">
            {shown.map((issue, i) => (
              <li
                key={issue.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}
              >
                <OfficerIssueCard issue={issue} now={now} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-hairline px-4 py-10 text-center text-[14px] text-muted">
      {children}
    </div>
  );
}

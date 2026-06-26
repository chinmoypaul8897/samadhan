"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useMyReports, type ReportDoc, type ReportStatus } from "@/lib/reports";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { cn } from "@/lib/cn";

const STATUS_LABEL: Record<ReportStatus, string> = {
  processing: "Processing",
  needs_review: "In review",
  seeded: "Tracked",
  linked: "Tracked",
  rejected: "Not recognised",
};

const STATUS_DOT: Record<ReportStatus, string> = {
  processing: "bg-link",
  needs_review: "bg-accent",
  seeded: "bg-brand",
  linked: "bg-brand",
  rejected: "bg-muted",
};

// Activity / "My reports" — live list of the signed-in citizen's reports
// (composite index reporterUid ASC, createdAt DESC). data-shapes §5.
export default function ActivityPage() {
  const { user, loading } = useAuth();
  const { reports, error } = useMyReports(user?.uid);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <h1 className="font-display text-[22px] font-normal tracking-[-0.01em] text-ink">
        My reports
      </h1>
      <p className="mt-1 text-[14px] text-muted">
        Everything you’ve reported, with live status.
      </p>

      <div className="mt-6">
        {error ? (
          <ErrorState
            title="Couldn’t load your reports"
            hint="Check your connection and try again."
          />
        ) : loading || reports === null ? (
          <ListSkeleton />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No reports yet"
            hint="Snap your first civic issue and it’ll show up here with a live SLA clock."
            action={{ label: "Report an issue", href: "/report" }}
          />
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function ReportRow({ report }: { report: ReportDoc }) {
  return (
    <li>
      <Link
        href={`/report/${report.id}`}
        className="flex items-center gap-3 rounded-md border border-hairline p-3 transition active:scale-[0.99] hover:bg-stone/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={report.media.downloadUrl}
          alt=""
          className="size-16 shrink-0 rounded-sm object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] text-ink">
            {STATUS_LABEL[report.status] ?? report.status}
          </p>
          <p className="text-[13px] text-muted">{relativeTime(report.createdAt)}</p>
        </div>
        <span
          className={cn(
            "size-2.5 rounded-full",
            STATUS_DOT[report.status] ?? "bg-muted",
          )}
          aria-hidden
        />
      </Link>
    </li>
  );
}

function relativeTime(ts?: Timestamp): string {
  if (!ts) return "Just now";
  const then = ts.toDate().getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "Just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function ListSkeleton() {
  return (
    <ul className="space-y-3" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-md border border-hairline p-3"
        >
          <div className="size-16 shrink-0 animate-pulse rounded-sm bg-stone" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-stone" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-stone" />
          </div>
        </li>
      ))}
    </ul>
  );
}

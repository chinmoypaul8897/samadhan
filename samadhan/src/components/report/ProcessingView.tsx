"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useReport } from "@/lib/reports";
import { PipelineSteps } from "./PipelineSteps";

// Live processing view. C2: shows the photo + 5 pending pipeline steps (the seam
// C3 upgrades to the animated AgentTraceConsole). Chrome is hidden on /report*,
// so the back link is the navigation affordance.
export function ProcessingView({ reportId }: { reportId: string }) {
  const { report, error } = useReport(reportId);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
      <Link
        href="/me"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} /> My reports
      </Link>

      {error ? (
        <Notice>
          Couldn’t load this report.{" "}
          <Link href="/me" className="underline underline-offset-4">
            Back to my reports
          </Link>
          .
        </Notice>
      ) : report === undefined ? (
        <ReportSkeleton />
      ) : report === null ? (
        <Notice>
          Report not found.{" "}
          <Link href="/report" className="underline underline-offset-4">
            Report a new issue
          </Link>
          .
        </Notice>
      ) : (
        <div className="mt-4 animate-fade-up">
          <div className="overflow-hidden rounded-lg border border-hairline bg-stone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={report.media.downloadUrl}
              alt="Reported issue"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          <div className="mt-5">
            <p className="font-mono text-[12px] uppercase tracking-[0.28px] text-brand">
              Agent · analysing
            </p>
            <h1 className="mt-1 font-display text-[22px] font-normal tracking-[-0.01em] text-ink">
              Working on your report
            </h1>
            <p className="mt-1 text-[14px] text-muted">
              Classifying, locating and routing your issue. This updates live as the
              agent works.
            </p>
          </div>

          <div className="mt-4">
            <PipelineSteps steps={report.pipeline} />
          </div>
        </div>
      )}
    </main>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 rounded-md border border-dashed border-hairline px-4 py-8 text-center text-[14px] text-muted">
      {children}
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="mt-4" aria-hidden>
      <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-stone" />
      <div className="mt-5 h-6 w-2/3 animate-pulse rounded bg-stone" />
      <div className="mt-4 h-40 w-full animate-pulse rounded-md bg-stone" />
    </div>
  );
}

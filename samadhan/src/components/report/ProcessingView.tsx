"use client";

import Link from "next/link";
import { ArrowLeft, TriangleAlert, Search, RotateCcw, ArrowRight } from "lucide-react";
import { useReport, type PerceiveAnalysis } from "@/lib/reports";
import { PipelineSteps } from "./PipelineSteps";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// Live processing view. C3: the Perceive step runs live in the dark console; on
// completion a result card appears, and non-civic / unreadable photos land on a
// friendly terminal state (never a dead "analysing…").
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

          {report.status === "rejected" ? (
            <TerminalCard
              tone="warn"
              icon={<TriangleAlert className="size-6 text-accent" strokeWidth={1.5} />}
              title="That doesn’t look like a civic issue"
              body={
                report.analysis?.reasoning ??
                "The agent couldn’t recognise a public infrastructure problem in this photo."
              }
              cta={{ href: "/report", label: "Take another photo" }}
            />
          ) : report.status === "needs_review" ? (
            <TerminalCard
              tone="info"
              icon={<Search className="size-6 text-link" strokeWidth={1.5} />}
              title="We’ll take a closer look"
              body="The agent couldn’t classify this one confidently. We’ve flagged it for review — you can also try a clearer photo."
              cta={{ href: "/report", label: "Try another photo" }}
            />
          ) : (
            <header className="mt-5">
              <p className="font-mono text-[12px] uppercase tracking-[0.28px] text-brand">
                Agent {report.issueId ? "· tracked" : report.analysis ? "· classified" : "· analysing"}
              </p>
              <h1 className="mt-1 font-display text-[22px] font-normal tracking-[-0.01em] text-ink">
                {report.issueId
                  ? "Your issue is now tracked"
                  : report.analysis
                    ? "Here’s what the agent sees"
                    : "Working on your report"}
              </h1>
              <p className="mt-1 text-[14px] text-muted">
                {report.issueId
                  ? "Classified, located and given a tracking ID with a live SLA clock."
                  : "Classifying, locating and routing your issue — this updates live."}
              </p>
            </header>
          )}

          {report.analysis && report.status !== "rejected" ? (
            <div className="mt-4">
              <ResultCard analysis={report.analysis} />
            </div>
          ) : null}

          {report.issueId ? (
            <Link
              href={`/issue/${report.issueId}`}
              className={buttonClasses("brand", "mt-4 w-full justify-center")}
            >
              View your tracked issue
              <ArrowRight className="size-4" strokeWidth={1.5} />
            </Link>
          ) : null}

          <div className="mt-4">
            <PipelineSteps steps={report.pipeline} />
          </div>
        </div>
      )}
    </main>
  );
}

function ResultCard({ analysis }: { analysis: PerceiveAnalysis }) {
  return (
    <div className="rounded-md border border-hairline bg-wash-blue/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-[18px] tracking-[-0.01em] text-ink">
          {analysis.serviceName}
        </span>
        <SeverityBadge severity={analysis.severity} />
        {analysis.hazard ? (
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
            Hazard
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink/80">{analysis.caption}</p>
      {analysis.ocrText ? (
        <p className="mt-1 text-[12px] text-muted">Read on sign: “{analysis.ocrText}”</p>
      ) : null}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: PerceiveAnalysis["severity"] }) {
  const tone =
    severity === "high"
      ? "bg-accent/15 text-accent"
      : severity === "medium"
        ? "bg-accent-soft/30 text-accent"
        : "bg-muted/15 text-muted";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", tone)}>
      {severity}
    </span>
  );
}

function TerminalCard({
  tone,
  icon,
  title,
  body,
  cta,
}: {
  tone: "warn" | "info";
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div
      className={cn(
        "mt-5 rounded-md border p-5",
        tone === "warn" ? "border-accent/30 bg-accent/5" : "border-hairline bg-wash-blue/50",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1">
          <h1 className="font-display text-[20px] font-normal tracking-[-0.01em] text-ink">
            {title}
          </h1>
          <p className="mt-1 text-[14px] leading-relaxed text-ink/75">{body}</p>
          <Link href={cta.href} className={buttonClasses("brand", "mt-4")}>
            <RotateCcw className="size-4" strokeWidth={1.5} />
            {cta.label}
          </Link>
        </div>
      </div>
    </div>
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
      <div className="mt-4 h-40 w-full animate-pulse rounded-sm bg-stone" />
    </div>
  );
}

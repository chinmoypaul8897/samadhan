"use client";

import Link from "next/link";
import { ArrowLeft, MapPin, Users } from "lucide-react";
import { useIssue, useActivity } from "@/lib/issues";
import type { Severity } from "@/lib/reports";
import { SlaClock } from "./SlaClock";
import { StatusChip } from "./StatusChip";
import { StaticMap } from "./StaticMap";
import { Timeline } from "./Timeline";
import { AuthorityCard } from "./AuthorityCard";
import { FilingCard } from "./FilingCard";
import { BreachBanner } from "./BreachBanner";
import { NotificationOptIn } from "./NotificationOptIn";
import { VerifyCard } from "./VerifyCard";
import { EscalationCard } from "./EscalationCard";
import { SupporterAction } from "./SupporterAction";
import { cn } from "@/lib/cn";

// Issue Detail (frontend-plan §D C4) — the tracked, deadlined issue. Public read.
export function IssueDetail({ issueId }: { issueId: string }) {
  const { issue, error } = useIssue(issueId);
  const activity = useActivity(issueId);

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
          Couldn’t load this issue.{" "}
          <Link href="/me" className="underline underline-offset-4">
            Back to my reports
          </Link>
          .
        </Notice>
      ) : issue === undefined ? (
        <DetailSkeleton />
      ) : issue === null ? (
        <Notice>Issue not found.</Notice>
      ) : (
        <div className="mt-4 animate-fade-up space-y-5">
          <BreachBanner issue={issue} />

          <header>
            <p className="font-mono text-[12px] uppercase tracking-[0.28px] text-muted">
              {issue.trackingId}
            </p>
            <h1 className="mt-1 font-display text-[24px] font-normal leading-tight tracking-[-0.01em] text-ink">
              {issue.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip status={issue.status} />
              <SeverityBadge severity={issue.severity} />
              {issue.hazard ? (
                <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                  Hazard
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                <Users className="size-3.5" strokeWidth={1.5} />
                {issue.supporterCount} {issue.supporterCount === 1 ? "reporter" : "citizens"}
              </span>
            </div>
          </header>

          <div className="overflow-hidden rounded-lg border border-hairline bg-stone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={issue.beforeMedia.downloadUrl}
              alt={issue.title}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          {issue.description ? (
            <p className="text-[15px] leading-relaxed text-ink/85">{issue.description}</p>
          ) : null}

          {/* Me-too (C13) — amplify standout #1; hidden for the reporter / private / signed-out. */}
          <SupporterAction
            issueId={issue.id}
            reporterUid={issue.reporterUid}
            isPublic={issue.isPublic}
          />

          {/* Verify (C9) — renders only on resolved_pending_verification / verified_resolved. */}
          <VerifyCard issue={issue} />

          <SlaClock
            deadline={issue.sla.deadline}
            slaHours={issue.sla.slaHours}
            resolvedAt={issue.resolvedAt ?? null}
          />

          {/* Escalation (C10) — renders only when the agent has drafted escalations on breach. */}
          <EscalationCard issueId={issue.id} reporterUid={issue.reporterUid} />

          <NotificationOptIn reporterUid={issue.reporterUid} />

          <section>
            <div className="flex items-start gap-1.5 text-[14px] text-ink">
              <MapPin className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.5} />
              <span>
                {issue.addressString}
                {issue.ward ? ` · ${issue.ward}` : ""}
              </span>
            </div>
            <div className="mt-2">
              <StaticMap
                lat={issue.location.latitude}
                lng={issue.location.longitude}
                label={issue.addressString}
              />
            </div>
          </section>

          <AuthorityCard routing={issue.routing} agencyResponsible={issue.agencyResponsible} />

          <FilingCard
            issueId={issue.id}
            filing={issue.filing}
            routing={issue.routing}
            agencyResponsible={issue.agencyResponsible}
            reporterUid={issue.reporterUid}
          />

          <section>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
              Timeline
            </h2>
            <Timeline items={activity} />
          </section>
        </div>
      )}
    </main>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 rounded-md border border-dashed border-hairline px-4 py-8 text-center text-[14px] text-muted">
      {children}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-4 space-y-4" aria-hidden>
      <div className="h-6 w-2/3 animate-pulse rounded bg-stone" />
      <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-stone" />
      <div className="h-20 w-full animate-pulse rounded-md bg-stone" />
      <div className="aspect-[2/1] w-full animate-pulse rounded-md bg-stone" />
    </div>
  );
}

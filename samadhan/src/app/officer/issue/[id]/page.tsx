"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useIssue, useActivity } from "@/lib/issues";
import { publicStorageUrl } from "@/lib/storage";
import { SlaClock } from "@/components/issue/SlaClock";
import { StatusChip } from "@/components/issue/StatusChip";
import { StaticMap } from "@/components/issue/StaticMap";
import { Timeline } from "@/components/issue/Timeline";
import { AuthorityCard } from "@/components/issue/AuthorityCard";
import { OfficerActionBar } from "@/components/officer/OfficerActionBar";
import { OfficerLogin } from "@/components/officer/OfficerLogin";
import { cn } from "@/lib/cn";

// /officer/issue/[id] (frontend-plan §D C8). Full issue + the action bar. Officers read the
// issue live via the same client hooks as the citizen (their role claim satisfies isStaff()),
// so the status/timeline stream as actions land.
export default function OfficerIssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, loading } = useAuth();
  const { issue, error } = useIssue(id);
  const activity = useActivity(id);

  const isStaff = profile?.role === "officer" || profile?.role === "admin";

  if (loading) {
    return <Shell><div className="h-40 animate-pulse rounded-lg bg-stone" /></Shell>;
  }
  if (!isStaff) return <OfficerLogin />;

  const afterUrl =
    issue && issue.verification?.afterMediaPath
      ? publicStorageUrl(issue.verification.afterMediaPath)
      : null;

  return (
    <Shell>
      <Link
        href="/officer"
        className="inline-flex items-center gap-1.5 text-[13px] text-muted transition hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} /> Queue
      </Link>

      {error ? (
        <Notice>Couldn’t load this issue.</Notice>
      ) : issue === undefined ? (
        <div className="mt-4 space-y-4" aria-hidden>
          <div className="h-6 w-2/3 animate-pulse rounded bg-stone" />
          <div className="aspect-[4/3] w-full animate-pulse rounded-lg bg-stone" />
          <div className="h-20 w-full animate-pulse rounded-md bg-stone" />
        </div>
      ) : issue === null ? (
        <Notice>Issue not found.</Notice>
      ) : (
        <div className="mt-4 animate-fade-up space-y-5">
          <header>
            <p className="font-mono text-[12px] uppercase tracking-[0.28px] text-muted">
              {issue.trackingId}
            </p>
            <h1 className="mt-1 font-display text-[24px] font-normal leading-tight tracking-[-0.01em] text-ink">
              {issue.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusChip status={issue.status} />
              {issue.hazard ? (
                <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                  Hazard
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[12px] font-medium text-brand">
                <Users className="size-3.5" strokeWidth={1.75} />
                {issue.supporterCount} {issue.supporterCount === 1 ? "reporter" : "citizens"}
              </span>
            </div>
          </header>

          {/* before / after */}
          <div className={cn("grid gap-3", afterUrl ? "grid-cols-2" : "grid-cols-1")}>
            <figure className="overflow-hidden rounded-lg border border-hairline bg-stone">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={issue.beforeMedia.downloadUrl} alt="Reported" className="aspect-[4/3] w-full object-cover" />
              <figcaption className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.28px] text-muted">
                Reported
              </figcaption>
            </figure>
            {afterUrl ? (
              <figure className="overflow-hidden rounded-lg border border-brand/20 bg-stone">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={afterUrl} alt="Proof of fix" className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.28px] text-brand">
                  Proof of fix
                </figcaption>
              </figure>
            ) : null}
          </div>

          {issue.description ? (
            <p className="text-[15px] leading-relaxed text-ink/85">{issue.description}</p>
          ) : null}

          <OfficerActionBar issue={issue} />

          <SlaClock
            deadline={issue.sla.deadline}
            slaHours={issue.sla.slaHours}
            resolvedAt={issue.resolvedAt ?? null}
          />

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

          <section>
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
              Timeline
            </h2>
            <Timeline items={activity} />
          </section>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">{children}</main>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 rounded-md border border-dashed border-hairline px-4 py-8 text-center text-[14px] text-muted">
      {children}
    </div>
  );
}

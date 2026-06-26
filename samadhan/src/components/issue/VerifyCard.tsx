"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, MapPin, Clock, Check, X, Users } from "lucide-react";
import { type IssueDoc, useFixVote } from "@/lib/issues";
import { useAuth } from "@/lib/auth-context";
import { confirmVerification, confirmFix } from "@/lib/citizen-api";
import { publicStorageUrl } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { BeforeAfter } from "./BeforeAfter";
import { cn } from "@/lib/cn";

// Verify (frontend-plan §D C9, standout #3). On resolved_pending_verification the reporter sees
// the before/after, the agent's independent verdict, and decides — confirm closes the issue
// (verified_resolved), deny reopens it. The AI verdict is advisory; only the citizen's tap
// finalises (data-shapes §8.6 — AI never auto-closes). AFFECTED citizens (not the reporter) can
// cast an advisory community vote ("looks fixed" / "still broken") that tallies but NEVER changes
// status. On verified_resolved everyone sees the resolved celebration.
export function VerifyCard({ issue }: { issue: IssueDoc }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"confirm" | "deny" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [voteBusy, setVoteBusy] = useState<"fixed" | "broken" | null>(null);

  const isOwner = !!user && user.uid === issue.reporterUid;
  const myVote = useFixVote(issue.id, isOwner ? undefined : user?.uid);
  const communityFixed = issue.verification?.communityFixedCount ?? 0;
  const communityBroken = issue.verification?.communityBrokenCount ?? 0;
  const afterUrl = issue.verification?.afterMediaPath
    ? publicStorageUrl(issue.verification.afterMediaPath)
    : null;

  // ── Resolved & verified: the celebration (public) ──
  if (issue.status === "verified_resolved") {
    return (
      <section>
        <SectionLabel>Resolved</SectionLabel>
        <div className="animate-pop-in rounded-lg border border-brand/20 bg-wash-green p-5">
          <div className="flex items-center gap-3">
            <span className="animate-resolve-bloom flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-on-dark">
              <CheckCircle2 className="size-6" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-[15px] font-medium text-ink">Fixed and confirmed</p>
              <p className="text-[13px] text-ink/70">
                The citizen verified the fix — the loop is closed.
                {communityFixed > 0
                  ? ` ${communityFixed} ${communityFixed === 1 ? "neighbour" : "neighbours"} confirmed it too.`
                  : ""}
              </p>
            </div>
          </div>
          {afterUrl ? (
            <div className="mt-4">
              <BeforeAfter beforeUrl={issue.beforeMedia.downloadUrl} afterUrl={afterUrl} highlightAfter />
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  // Only render the verify flow while awaiting confirmation.
  if (issue.status !== "resolved_pending_verification") return null;

  const v = issue.verification?.aiVerdict;
  const positive = !!v && v.resolved && v.confidence >= 0.6 && v.gpsMatch;

  const decide = async (confirmed: boolean) => {
    if (!user) return;
    setBusy(confirmed ? "confirm" : "deny");
    setErr(null);
    try {
      await confirmVerification(issue.id, confirmed);
      // onSnapshot flips the card (→ celebration, or the issue returns to in-progress).
      toast(
        confirmed
          ? { title: "Marked resolved", body: "Thanks for confirming the fix." }
          : { title: "Reopened", body: "We’ve told the authority it’s not fixed." },
      );
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const castVote = async (verdict: "fixed" | "broken") => {
    if (!user) return;
    setVoteBusy(verdict);
    try {
      await confirmFix(issue.id, verdict);
      toast(
        verdict === "fixed"
          ? { title: "Thanks for weighing in", body: "You confirmed this looks fixed." }
          : { title: "Noted", body: "You flagged it as still broken." },
      );
    } catch (e) {
      toast({ title: "Couldn’t save that", body: (e as Error).message });
    } finally {
      setVoteBusy(null);
    }
  };

  return (
    <section>
      <SectionLabel>Verify the fix</SectionLabel>

      <BeforeAfter
        beforeUrl={issue.beforeMedia.downloadUrl}
        afterUrl={afterUrl}
        highlightAfter
      />

      {/* Agent verdict */}
      <div
        className={cn(
          "mt-3 rounded-md border p-4",
          !v
            ? "border-hairline bg-wash-blue/40"
            : positive
              ? "border-brand/20 bg-wash-green"
              : "border-accent/30 bg-accent/5",
        )}
      >
        <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
          <Sparkles className="size-3.5" strokeWidth={1.75} /> Agent’s check
        </div>

        {!v ? (
          <p className="mt-2 flex items-center gap-2 text-[14px] text-ink/75">
            <Loader2 className="size-4 animate-spin text-link" strokeWidth={1.75} />
            Comparing the proof against the original photo…
          </p>
        ) : (
          <>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={cn(
                  "text-[15px] font-medium",
                  positive ? "text-brand" : "text-accent",
                )}
              >
                {positive ? (
                  <>
                    <CheckCircle2 className="mr-1 inline size-4 -translate-y-px" strokeWidth={1.75} />
                    This looks resolved
                  </>
                ) : (
                  <>
                    <AlertTriangle className="mr-1 inline size-4 -translate-y-px" strokeWidth={1.75} />
                    Worth a closer look before you confirm
                  </>
                )}
              </span>
              <span className="font-mono text-[12px] text-muted">
                {Math.round(v.confidence * 100)}% sure
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80">{v.reasoning}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <CheckChip ok={v.gpsMatch} icon={<MapPin className="size-3" strokeWidth={2} />}>
                {v.gpsMatch ? "Same location" : "Location may differ"}
              </CheckChip>
              <CheckChip ok={v.timestampMatch} icon={<Clock className="size-3" strokeWidth={2} />}>
                {v.timestampMatch ? "Taken after the report" : "Timing looks off"}
              </CheckChip>
            </div>
          </>
        )}
      </div>

      {/* Community tally — affected citizens' advisory votes (shown to everyone) */}
      {communityFixed + communityBroken > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-hairline bg-stone/40 px-3 py-2 text-[13px] text-ink">
          <Users className="size-4 shrink-0 text-brand" strokeWidth={1.75} />
          <span>
            <span className="font-medium text-brand">{communityFixed}</span>{" "}
            {communityFixed === 1 ? "citizen confirms" : "citizens confirm"} this looks fixed
            {communityBroken > 0 ? (
              <>
                {" "}· <span className="font-medium text-accent">{communityBroken}</span> say still broken
              </>
            ) : null}
          </span>
        </div>
      ) : null}

      {/* The decision area */}
      {isOwner ? (
        // The reporter decides — only this closes the issue.
        <div className="mt-3">
          <p className="mb-2 text-[13px] text-muted">
            Your call — only you can close this. The agent’s read (and the community’s) is a second opinion.
          </p>
          <div className="flex gap-2">
            <Button
              variant="brand"
              className="flex-1"
              loading={busy === "confirm"}
              disabled={busy === "deny"}
              onClick={() => decide(true)}
            >
              <Check className="size-4" strokeWidth={2} /> Yes, it’s fixed
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              loading={busy === "deny"}
              disabled={busy === "confirm"}
              onClick={() => decide(false)}
            >
              <X className="size-4" strokeWidth={2} /> Still broken
            </Button>
          </div>
          {err ? <p className="mt-2 text-[13px] text-danger">Couldn’t save that: {err}. Try again.</p> : null}
        </div>
      ) : user ? (
        // Affected citizens cast an advisory vote (never closes the issue).
        myVote ? (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-brand">
            <Check className="size-4 shrink-0" strokeWidth={2} />
            {myVote === "fixed" ? "You confirmed this looks fixed." : "You flagged it as still broken."}
          </p>
        ) : (
          <div className="mt-3">
            <p className="mb-2 text-[13px] text-muted">
              Affected by this too? Tell us if the fix holds up — the community’s read keeps “resolved” honest.
            </p>
            <div className="flex gap-2">
              <Button
                variant="brand"
                className="flex-1"
                loading={voteBusy === "fixed"}
                disabled={voteBusy === "broken"}
                onClick={() => castVote("fixed")}
              >
                <Check className="size-4" strokeWidth={2} /> Looks fixed
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                loading={voteBusy === "broken"}
                disabled={voteBusy === "fixed"}
                onClick={() => castVote("broken")}
              >
                <X className="size-4" strokeWidth={2} /> Still broken
              </Button>
            </div>
          </div>
        )
      ) : (
        <p className="mt-3 text-[13px] text-muted">
          Marked resolved by the authority — awaiting the reporter’s confirmation.
        </p>
      )}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">{children}</h2>
  );
}

function CheckChip({
  ok,
  icon,
  children,
}: {
  ok: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        ok ? "bg-brand/10 text-brand" : "bg-danger/10 text-danger",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

"use client";

import { useState } from "react";
import { Megaphone, Bell, Scale, Send, CheckCircle2, Info } from "lucide-react";
import { useEscalations, type Escalation } from "@/lib/issues";
import { useAuth } from "@/lib/auth-context";
import { sendEscalation } from "@/lib/citizen-api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { ConsentSheet } from "@/components/ui/ConsentSheet";
import { cn } from "@/lib/cn";

// Escalation (frontend-plan §D C10, standout #3). When the SLA is breached the agent drafts the
// next escalation rung (reminder → appeal → RTI). The reporter sees each draft and sends it with
// one tap (sending stays the human gate — no auto-posting). Read-only for non-reporters.
const META: Record<Escalation["type"], { label: string; icon: typeof Bell }> = {
  reminder: { label: "Reminder", icon: Bell },
  higher_authority_appeal: { label: "Higher-authority appeal", icon: Megaphone },
  rti_draft: { label: "RTI application", icon: Scale },
  social_post: { label: "Public post", icon: Megaphone },
};

export function EscalationCard({ issueId, reporterUid }: { issueId: string; reporterUid: string }) {
  const { user } = useAuth();
  // Escalations are reporter/officer-read-only (firestore rules). Only subscribe when the viewer
  // is the reporter — otherwise a non-reporter opening a public issue throws a permissions error.
  const isReporter = !!user && user.uid === reporterUid;
  const escalations = useEscalations(isReporter ? issueId : undefined);
  if (escalations.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
        Escalation
      </h2>
      <p className="mb-3 text-[13px] text-muted">
        The deadline passed, so the agent drafted these on your behalf. Sending stays your call.
      </p>
      <ul className="space-y-2.5">
        {escalations.map((e) => (
          <li key={e.id} className="animate-fade-up">
            <EscalationRow issueId={issueId} reporterUid={reporterUid} esc={e} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EscalationRow({
  issueId,
  reporterUid,
  esc,
}: {
  issueId: string;
  reporterUid: string;
  esc: Escalation;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showRti, setShowRti] = useState(false);

  const isOwner = !!user && user.uid === reporterUid;
  const meta = META[esc.type] ?? META.reminder;
  const Icon = meta.icon;
  const sent = esc.status === "sent";

  const send = async () => {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      await sendEscalation(issueId, esc.id);
      setOpen(false); // onSnapshot flips the row to the sent state
      toast({ title: "Escalation sent", body: `Your ${meta.label.toLowerCase()} is on its way.` });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-md border p-4",
        sent ? "border-brand/20 bg-wash-green" : "border-accent/30 bg-accent/5",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
            sent ? "bg-brand/10 text-brand" : "bg-accent/15 text-accent",
          )}
        >
          {sent ? <CheckCircle2 className="size-4" strokeWidth={1.75} /> : <Icon className="size-4" strokeWidth={1.75} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-medium text-ink">{meta.label}</p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                sent ? "bg-brand/10 text-brand" : "bg-accent/15 text-accent",
              )}
            >
              {sent ? "Sent" : "Drafted"}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-muted">
            To {esc.target} · {esc.triggerReason}
          </p>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/75">
            {esc.content}
          </p>

          {esc.type === "rti_draft" ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowRti((v) => !v)}
                className="inline-flex items-center gap-1 text-[12px] text-link"
              >
                <Info className="size-3" strokeWidth={2} /> What’s an RTI?
              </button>
              {showRti ? (
                <p className="mt-1 rounded-md bg-wash-blue/60 px-3 py-2 text-[12px] leading-relaxed text-ink/75">
                  A Right to Information request under the RTI Act, 2005 legally compels the
                  authority to respond within 30 days — naming who is responsible and why the work
                  is delayed.
                </p>
              ) : null}
            </div>
          ) : null}

          {sent ? (
            <p className="mt-3 text-[12px] text-ink/70">
              Sent to {esc.target}. The authority is now on record.
            </p>
          ) : isOwner ? (
            <Button variant="brand" className="mt-3" onClick={() => setOpen(true)}>
              <Send className="size-4" strokeWidth={1.75} /> Review &amp; send
            </Button>
          ) : (
            <p className="mt-3 text-[12px] text-muted">Awaiting the reporter to send.</p>
          )}
        </div>
      </div>

      <ConsentSheet
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title={`Send this ${meta.label.toLowerCase()}`}
        subtitle={`To ${esc.target}`}
        footer={
          <Button variant="brand" className="w-full" loading={busy} onClick={send}>
            <Send className="size-4" strokeWidth={1.75} /> Send to {esc.target}
          </Button>
        }
      >
        <p className="mb-3 text-[13px] text-ink/70">
          The agent drafted this because the deadline lapsed. Review it — sending puts the
          authority on record.
        </p>
        <article className="whitespace-pre-wrap rounded-md border border-hairline bg-stone/50 p-4 text-[13px] leading-relaxed text-ink">
          {esc.content}
        </article>
        {err ? <p className="mt-3 text-[13px] text-danger">Couldn’t send: {err}. Try again.</p> : null}
      </ConsentSheet>
    </div>
  );
}

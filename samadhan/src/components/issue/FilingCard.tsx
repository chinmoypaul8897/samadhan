"use client";

import { useState } from "react";
import { FileText, CheckCircle2, Loader2 } from "lucide-react";
import type { Filing, Routing } from "@/lib/issues";
import { useAuth } from "@/lib/auth-context";
import { fileComplaint } from "@/lib/citizen-api";
import { Button } from "@/components/ui/Button";
import { ConsentSheet } from "@/components/ui/ConsentSheet";

// Act reveal + file consent (frontend-plan §D C6, standout #2). Shows the agent's drafted
// complaint and the one-tap "File to <authority>" gate. States: drafting → prepared (review
// + file) → submitted (filed confirmation). Only the reporter sees the File CTA; others see
// the prepared draft read-only.
export function FilingCard({
  issueId,
  filing,
  routing,
  agencyResponsible,
  reporterUid,
}: {
  issueId: string;
  filing: Filing | undefined;
  routing: Routing | null;
  agencyResponsible: string;
  reporterUid: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!routing) return null; // AuthorityCard shows the "routing…" state

  const shortName = routing.authorityId.toUpperCase();
  const isOwner = !!user && user.uid === reporterUid;
  const status = filing?.status ?? "draft";

  // ── Submitted: filed confirmation ──
  if (status === "submitted") {
    return (
      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
          Formal complaint
        </h2>
        <div className="animate-pop-in rounded-lg border border-brand/20 bg-wash-green p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-on-dark">
              <CheckCircle2 className="size-5" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-[15px] font-medium text-ink">Filed to {shortName}</p>
              <p className="text-[13px] text-ink/70">
                The agent is now tracking the resolution against the SLA.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Drafting / draft / error: not yet ready to file ──
  if (status !== "prepared" || !filing?.complaintText) {
    return (
      <section>
        <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
          Formal complaint
        </h2>
        <p className="flex items-center gap-2 rounded-md bg-wash-blue/50 px-3 py-2.5 text-[13px] text-ink/75">
          <Loader2 className="size-3.5 animate-spin text-link" strokeWidth={1.75} />
          Drafting the formal complaint to {shortName}…
        </p>
      </section>
    );
  }

  // ── Prepared: preview + file consent ──
  const file = async () => {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      await fileComplaint(issueId);
      setOpen(false); // onSnapshot flips the card to the submitted state
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
        Formal complaint
      </h2>
      <div className="rounded-md border border-hairline bg-canvas p-4">
        <div className="flex items-center gap-2 text-[14px] text-ink">
          <FileText className="size-4 text-brand" strokeWidth={1.5} />
          The agent drafted a formal complaint to {shortName}.
        </div>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/70">
          {filing.complaintText}
        </p>
        {isOwner ? (
          <Button variant="brand" className="mt-4 w-full" onClick={() => setOpen(true)}>
            Review &amp; file to {shortName}
          </Button>
        ) : (
          <p className="mt-3 text-[12px] text-muted">
            Awaiting the reporter’s confirmation to file.
          </p>
        )}
      </div>

      <ConsentSheet
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        title={`File to ${shortName}`}
        subtitle={agencyResponsible}
        footer={
          <Button variant="brand" className="w-full" loading={busy} onClick={file}>
            File to {shortName}
          </Button>
        }
      >
        <p className="mb-3 text-[13px] text-ink/70">
          The agent prepared this complaint. Filing sends it to {shortName}; the SLA clock is
          already running.
        </p>
        <article className="whitespace-pre-wrap rounded-md border border-hairline bg-stone/50 p-4 text-[13px] leading-relaxed text-ink">
          {filing.complaintText}
        </article>
        {err ? <p className="mt-3 text-[13px] text-danger">Couldn’t file: {err}. Try again.</p> : null}
      </ConsentSheet>
    </section>
  );
}

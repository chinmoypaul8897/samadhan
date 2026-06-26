"use client";

import { useRef, useState } from "react";
import { Camera, Check, CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { IssueDoc } from "@/lib/issues";
import { useAuth } from "@/lib/auth-context";
import { officerAction, type OfficerAction } from "@/lib/officer-api";
import { uploadAfterPhoto, downscaleImage } from "@/lib/storage";
import { useToast } from "@/components/ui/Toast";
import { ConsentSheet } from "@/components/ui/ConsentSheet";
import { Button, buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// Officer action bar (frontend-plan §D C8). Buttons are gated by the current status (the §9
// graph); the server re-validates. resolve opens a proof-of-fix sheet (after-photo required);
// cannot_fix opens a note sheet (note required). On success the live useIssue hook on the
// detail page reflects the new status — no manual refetch.
const ERROR_COPY: Record<string, string> = {
  FORBIDDEN: "You can’t act on this issue.",
  MISSING_PHOTO: "Add a proof photo first.",
  MISSING_NOTE: "Add a reason first.",
  ILLEGAL_TRANSITION: "That step isn’t available from the current status.",
  STALE_STATUS: "The issue just changed — reopen and retry.",
  NOT_FOUND: "Issue not found.",
};

export function OfficerActionBar({ issue }: { issue: IssueDoc }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState<OfficerAction | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [cantOpen, setCantOpen] = useState(false);

  // resolve sheet state
  const fileRef = useRef<HTMLInputElement>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [afterPath, setAfterPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // cannot_fix sheet state
  const [note, setNote] = useState("");

  const run = async (action: OfficerAction, extra?: { note?: string; afterMediaPath?: string }) => {
    setBusy(action);
    const res = await officerAction(issue.id, { action, ...extra });
    setBusy(null);
    if (res.ok) {
      setResolveOpen(false);
      setCantOpen(false);
      toast({ title: "Done", body: `Issue marked ${res.to?.replace(/_/g, " ")}.` });
    } else {
      toast({ title: "Couldn’t update", body: ERROR_COPY[res.error ?? ""] ?? "Please try again." });
    }
  };

  const onPickAfter = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const blob = await downscaleImage(file);
      const media = await uploadAfterPhoto(issue.id, user.uid, blob);
      setAfterPath(media.path);
      setAfterUrl(media.downloadUrl);
    } catch {
      toast({ title: "Upload failed", body: "Couldn’t upload that photo — try again." });
    } finally {
      setUploading(false);
    }
  };

  const status = issue.status;

  // Terminal / waiting states — no actions, just a line.
  if (status === "resolved_pending_verification") {
    return <Waiting>Resolved — awaiting the citizen’s confirmation.</Waiting>;
  }
  if (status === "verified_resolved") {
    return <Waiting tone="brand">Resolved and verified by the citizen.</Waiting>;
  }
  if (status === "cannot_fix") {
    return <Waiting>Marked can’t fix{issue.statusNotes ? ` — ${issue.statusNotes}` : ""}.</Waiting>;
  }

  const canAcknowledge = status === "submitted";
  const canAssign = status === "acknowledged";
  const canStart = status === "acknowledged" || status === "assigned" || status === "reopened";
  const canResolve = status === "in_progress";
  const canCannotFix =
    status === "acknowledged" || status === "assigned" || status === "in_progress";

  return (
    <section className="rounded-md border border-hairline bg-stone/40 p-4">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">Actions</h2>
      <div className="flex flex-wrap gap-2">
        {canAcknowledge && (
          <Button variant="brand" loading={busy === "acknowledge"} onClick={() => run("acknowledge")}>
            Acknowledge
          </Button>
        )}
        {canAssign && (
          <Button variant="outline" loading={busy === "assign"} onClick={() => run("assign")}>
            Assign to me
          </Button>
        )}
        {canStart && (
          <Button variant="brand" loading={busy === "start"} onClick={() => run("start")}>
            Start work
          </Button>
        )}
        {canResolve && (
          <Button variant="brand" onClick={() => setResolveOpen(true)}>
            <Check className="size-4" strokeWidth={2} /> Resolve with proof
          </Button>
        )}
        {canCannotFix && (
          <button
            type="button"
            onClick={() => setCantOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-hairline px-5 py-3 text-[14px] font-medium text-muted transition hover:border-danger/40 hover:text-danger"
          >
            <XCircle className="size-4" strokeWidth={1.5} /> Can’t fix
          </button>
        )}
      </div>

      {/* Resolve sheet — proof-of-fix required */}
      <ConsentSheet
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        title="Resolve this issue"
        subtitle="Upload a photo of the fix. The citizen confirms before it’s verified."
        footer={
          <Button
            variant="brand"
            className="w-full"
            disabled={!afterPath || uploading}
            loading={busy === "resolve"}
            onClick={() => afterPath && run("resolve", { afterMediaPath: afterPath })}
          >
            <CheckCircle2 className="size-4" strokeWidth={1.75} />
            Mark resolved
          </Button>
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onPickAfter}
        />
        {afterUrl ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-md border border-hairline bg-stone">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={afterUrl} alt="Proof of fix" className="aspect-[4/3] w-full object-cover" />
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-[13px] text-link underline underline-offset-4"
            >
              Replace photo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-hairline px-4 py-10 text-muted transition hover:border-brand/40 hover:text-ink disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="size-6 animate-spin" strokeWidth={1.5} />
            ) : (
              <Camera className="size-6" strokeWidth={1.5} />
            )}
            <span className="text-[13px]">{uploading ? "Uploading…" : "Take / choose the after photo"}</span>
          </button>
        )}
      </ConsentSheet>

      {/* Can't-fix sheet — note required */}
      <ConsentSheet
        open={cantOpen}
        onClose={() => setCantOpen(false)}
        title="Can’t fix this issue"
        subtitle="Tell the citizen why. This closes the issue with your reason."
        footer={
          <button
            type="button"
            disabled={!note.trim() || busy === "cannot_fix"}
            onClick={() => run("cannot_fix", { note: note.trim() })}
            className={cn(
              buttonClasses("primary", "w-full"),
              "bg-danger hover:bg-danger/90",
            )}
          >
            {busy === "cannot_fix" ? "Closing…" : "Mark can’t fix"}
          </button>
        }
      >
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="e.g. Outside our jurisdiction — forwarded to the highways division."
          className="w-full resize-none rounded-sm border border-hairline bg-canvas px-3 py-2.5 text-[14px] text-ink outline-none transition focus:border-focus focus:ring-2 focus:ring-focus/30"
        />
      </ConsentSheet>
    </section>
  );
}

function Waiting({ children, tone }: { children: React.ReactNode; tone?: "brand" }) {
  return (
    <section
      className={cn(
        "flex items-center gap-2 rounded-md border px-4 py-3 text-[14px]",
        tone === "brand"
          ? "border-brand/20 bg-wash-green text-ink"
          : "border-hairline bg-stone/40 text-muted",
      )}
    >
      <CheckCircle2 className="size-4 shrink-0 text-brand" strokeWidth={1.5} />
      {children}
    </section>
  );
}

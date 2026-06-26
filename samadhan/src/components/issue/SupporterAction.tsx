"use client";

import { useState } from "react";
import { Users, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useHasSupported } from "@/lib/issues";
import { supportIssue } from "@/lib/citizen-api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

// "This affects me too" (frontend-plan §D C13, amplifies standout #1). One tap adds the citizen
// to an issue's supporters (+1 supporterCount, live in the header). Hidden for the seed reporter
// (they already count), on private issues, and before sign-in. Idempotent server-side; the UI
// flips to a confirmed state with a deep-green ring pulse (mergeAmplify family).
export function SupporterAction({
  issueId,
  reporterUid,
  isPublic,
}: {
  issueId: string;
  reporterUid: string;
  isPublic: boolean;
}) {
  const { user } = useAuth();
  const supported = useHasSupported(issueId, user?.uid);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  if (!isPublic || !user || user.uid === reporterUid) return null;

  const already = supported === true || justAdded;

  const support = async () => {
    setBusy(true);
    try {
      const { already: was } = await supportIssue(issueId);
      setJustAdded(true);
      toast(
        was
          ? { title: "Already counted", body: "You're already supporting this issue." }
          : { title: "Thanks for speaking up", body: "Your voice adds weight to this issue." },
      );
    } catch (e) {
      toast({ title: "Couldn’t add your voice", body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (already) {
    return (
      <div
        className={cn(
          "flex min-h-11 items-center justify-center gap-2 rounded-md border border-brand/30 bg-wash-green px-4 py-3 text-[14px] font-medium text-brand",
          justAdded && "animate-ring-pulse",
        )}
      >
        <Check className="size-4" strokeWidth={2} /> You’re supporting this issue
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={support}
      disabled={busy}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-pill border border-brand bg-canvas px-4 py-3 text-[14px] font-medium text-brand transition hover:bg-wash-green active:scale-[0.98] disabled:opacity-60"
    >
      <Users className="size-4" strokeWidth={1.75} />
      {busy ? "Adding your voice…" : "This affects me too"}
    </button>
  );
}

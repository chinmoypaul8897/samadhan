import { cn } from "@/lib/cn";

// issueStatus → semantic colour (frontend-plan §A.2).
const LABEL: Record<string, string> = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved_pending_verification: "Awaiting your confirm",
  verified_resolved: "Resolved",
  cannot_fix: "Can’t fix",
  reopened: "Reopened",
};
const TONE: Record<string, string> = {
  submitted: "bg-stone text-ink",
  acknowledged: "bg-stone text-ink",
  assigned: "bg-stone text-ink",
  in_progress: "bg-link/10 text-link",
  resolved_pending_verification: "bg-accent/15 text-accent",
  verified_resolved: "bg-brand/10 text-brand",
  cannot_fix: "bg-muted/15 text-muted",
  reopened: "bg-accent/15 text-accent",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
        TONE[status] ?? "bg-stone text-ink",
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {LABEL[status] ?? status}
    </span>
  );
}

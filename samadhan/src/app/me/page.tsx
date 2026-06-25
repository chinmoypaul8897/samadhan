import { ClipboardList } from "lucide-react";

// Activity / "My reports" — empty state for C1. Wired to the reporter's live
// reports + issues in later chunks (data-shapes.md §5/§6).
export default function ActivityPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <h1 className="font-display text-[22px] font-normal tracking-[-0.01em] text-ink">
        My reports
      </h1>
      <p className="mt-1 text-[14px] text-muted">
        Everything you’ve reported, with live status.
      </p>

      <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed border-hairline px-6 py-16 text-center">
        <ClipboardList className="size-8 text-muted" strokeWidth={1.5} />
        <p className="mt-4 font-sans text-[15px] text-ink">No reports yet</p>
        <p className="mt-1 max-w-xs text-[13px] text-muted">
          Snap your first civic issue and it’ll show up here with a live SLA
          clock.
        </p>
      </div>
    </main>
  );
}

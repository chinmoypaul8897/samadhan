import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Shared empty-state primitive (frontend-plan §C, C12). Flat + dashed-hairline, Cohere-restrained.
// Replaces the bespoke per-screen `Notice`/empty blocks so every list surface reads the same.
// Optional icon + hint + a single action (link or handler). Tap target ≥44px on the action.

type Action = { label: string; href: string } | { label: string; onClick: () => void };

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: Action;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-hairline px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="size-8 text-muted" strokeWidth={1.5} aria-hidden /> : null}
      <p className={cn("font-sans text-[15px] text-ink", Icon && "mt-4")}>{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-[13px] text-muted">{hint}</p> : null}
      {action ? <ActionButton action={action} /> : null}
    </div>
  );
}

const ACTION_CLS =
  "mt-5 inline-flex min-h-[44px] items-center rounded-pill bg-brand px-5 py-2.5 text-[14px] font-medium text-on-dark transition active:scale-[0.97]";

function ActionButton({ action }: { action: Action }) {
  if ("href" in action)
    return (
      <Link href={action.href} className={ACTION_CLS}>
        {action.label}
      </Link>
    );
  return (
    <button type="button" onClick={action.onClick} className={ACTION_CLS}>
      {action.label}
    </button>
  );
}

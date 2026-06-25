import {
  Sparkles,
  CircleDot,
  UserCheck,
  TriangleAlert,
  CheckCircle2,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { Timestamp } from "firebase/firestore";
import type { ActivityItem } from "@/lib/issues";
import { cn } from "@/lib/cn";

// issues/{id}/activity rendered newest-first (frontend-plan Timeline → research-table).
const ICON: Record<string, LucideIcon> = {
  system: Sparkles,
  status_change: CircleDot,
  officer_action: UserCheck,
  new_supporter: UserCheck,
  escalation: TriangleAlert,
  verification: CheckCircle2,
  comment: MessageSquare,
};

function rel(ts?: Timestamp): string {
  if (!ts) return "just now";
  const s = Math.max(0, Math.round((Date.now() - ts.toMillis()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function Timeline({ items }: { items: ActivityItem[] }) {
  if (!items.length) {
    return (
      <p className="rounded-md border border-dashed border-hairline px-4 py-6 text-center text-[13px] text-muted">
        No activity yet.
      </p>
    );
  }
  return (
    <ol className="overflow-hidden rounded-md border border-hairline">
      {items.map((a, i) => {
        const Icon = ICON[a.type] ?? CircleDot;
        return (
          <li
            key={a.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3",
              i > 0 && "border-t border-hairline",
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={1.5} />
            <p className="min-w-0 flex-1 text-[14px] text-ink">{a.message}</p>
            <span className="shrink-0 font-mono text-[11px] text-muted">{rel(a.createdAt)}</span>
          </li>
        );
      })}
    </ol>
  );
}

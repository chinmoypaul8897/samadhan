import {
  Circle,
  LoaderCircle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  type LucideIcon,
} from "lucide-react";
import type { StepTrace, StepStatus } from "@/lib/reports";
import { cn } from "@/lib/cn";

// C2: a static, live-updating list of the 5 intake steps. C3 upgrades this seam
// into the dark AgentTraceConsole (agent-console-card) with traceStep motion.
const LABELS: Record<string, string> = {
  perceive: "Perceive",
  locate: "Locate",
  dedup: "De-duplicate",
  route: "Route",
  act: "File",
};
const ICON: Record<StepStatus, LucideIcon> = {
  pending: Circle,
  running: LoaderCircle,
  done: CheckCircle2,
  error: XCircle,
  skipped: MinusCircle,
};

export function PipelineSteps({ steps }: { steps: StepTrace[] }) {
  return (
    <ol className="overflow-hidden rounded-md border border-hairline">
      {steps.map((s, i) => {
        const Icon = ICON[s.status] ?? Circle;
        return (
          <li
            key={s.step}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              i > 0 && "border-t border-hairline",
            )}
          >
            <Icon
              className={cn(
                "size-5 shrink-0",
                s.status === "running" && "animate-spin text-link",
                s.status === "done" && "text-brand",
                s.status === "error" && "text-danger",
                (s.status === "pending" || s.status === "skipped") && "text-muted",
              )}
              strokeWidth={1.5}
            />
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-[15px]",
                  s.status === "pending" ? "text-muted" : "text-ink",
                )}
              >
                {LABELS[s.step] ?? s.step}
              </p>
              {s.summary ? (
                <p className="truncate text-[13px] text-muted">{s.summary}</p>
              ) : null}
            </div>
            {typeof s.latencyMs === "number" ? (
              <span className="font-mono text-[12px] text-muted">
                {s.latencyMs}ms
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

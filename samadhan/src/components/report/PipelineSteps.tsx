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

// The live agent-thinking trace, rendered as DESIGN.md's dark agent-console-card.
// C3 lights up Perceive (pending→running→done via onSnapshot); Locate/Dedup/Route/
// File come alive in C4–C6.
const LABELS: Record<string, string> = {
  perceive: "Perceive",
  locate: "Locate",
  dedup: "De-duplicate",
  route: "Route",
  act: "File",
};
const BADGE: Record<string, string> = {
  perceive: "Gemini",
  locate: "Maps",
  dedup: "Gemini Vision",
  route: "Rules",
  act: "Gemini",
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
    <div className="rounded-sm bg-primary p-1.5">
      <ol>
        {steps.map((s, i) => {
          const Icon = ICON[s.status] ?? Circle;
          return (
            <li
              key={s.step}
              className={cn(
                "flex items-center gap-3 px-3 py-3",
                i > 0 && "border-t border-white/10",
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0",
                  s.status === "running" && "animate-spin text-link",
                  s.status === "done" && "text-wash-green",
                  s.status === "error" && "text-accent",
                  (s.status === "pending" || s.status === "skipped") &&
                    "text-white/35",
                )}
                strokeWidth={1.5}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[15px]",
                      s.status === "pending" ? "text-white/50" : "text-on-dark",
                    )}
                  >
                    {LABELS[s.step] ?? s.step}
                  </span>
                  <span className="rounded-full border border-white/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.28px] text-white/45">
                    {BADGE[s.step]}
                  </span>
                </div>
                {s.summary ? (
                  <p className="truncate text-[13px] text-white/55">{s.summary}</p>
                ) : null}
              </div>
              {typeof s.latencyMs === "number" ? (
                <span className="font-mono text-[12px] text-white/45">
                  {s.latencyMs}ms
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

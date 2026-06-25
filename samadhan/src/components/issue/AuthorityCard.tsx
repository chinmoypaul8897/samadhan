import { Building2 } from "lucide-react";
import type { Routing } from "@/lib/issues";

// Route reveal (frontend-plan §D C6) — the authority the agent routed this issue to + the
// "why this body" reasoning. When routing is absent the agent is still routing.
export function AuthorityCard({
  routing,
  agencyResponsible,
}: {
  routing: Routing | null;
  agencyResponsible: string;
}) {
  if (!routing) {
    return (
      <p className="rounded-md bg-wash-blue/50 px-3 py-2.5 text-[13px] text-ink/75">
        The agent is routing this to the right authority and drafting the formal complaint…
      </p>
    );
  }

  const shortName = routing.authorityId.toUpperCase();
  const name = agencyResponsible || shortName;

  return (
    <section>
      <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.28px] text-muted">
        Routed to
      </h2>
      <div className="rounded-md border border-hairline bg-canvas p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand/10 text-brand">
            <Building2 className="size-5" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-stone px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.28px] text-ink">
                {shortName}
              </span>
              <span className="truncate text-[13px] text-muted">{routing.department}</span>
            </div>
            <p className="mt-1 truncate text-[14px] text-ink">{name}</p>
          </div>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-ink/75">{routing.reasoning}</p>
      </div>
    </section>
  );
}

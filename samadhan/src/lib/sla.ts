// SLA state (data-shapes §9 slaState; backend-plan A.6). Pure + shared client/server.
// The live countdown colour is computed CLIENT-side from the deadline each tick — the
// stored issue.sla.state is only the creation-time snapshot (the sweep that flips it
// server-side is C7).
export type SlaState = "on_track" | "due_soon" | "breached" | "met";

export function computeSlaState(
  deadlineMs: number,
  slaHours: number,
  nowMs: number,
  resolvedMs?: number | null,
): SlaState {
  if (resolvedMs != null) return resolvedMs <= deadlineMs ? "met" : "breached";
  if (nowMs > deadlineMs) return "breached";
  const remainingMs = deadlineMs - nowMs;
  if (remainingMs < slaHours * 3600_000 * 0.25) return "due_soon";
  return "on_track";
}

/** "12h 04m" / "Breached by 3h 10m" — for the live clock. */
export function formatRemaining(deadlineMs: number, nowMs: number): string {
  const diff = Math.abs(deadlineMs - nowMs);
  const totalMin = Math.floor(diff / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const hm = h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  return nowMs > deadlineMs ? `Breached by ${hm}` : hm;
}

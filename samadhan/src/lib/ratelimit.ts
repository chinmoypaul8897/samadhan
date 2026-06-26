import "server-only";

// Best-effort in-memory rate limiter (C12 hardening). Cloud Run is multi-instance and
// stateless, so this is deliberately PER-INSTANCE: it bounds runaway loops and accidental spam
// against the Gemini free tier, not a hostile distributed flood (that would need Firestore or
// Redis — overkill for a demo, and the honest scope is documented here). Fixed-window counter
// keyed by a caller string (client IP for the unauthenticated intake kick); self-prunes.

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

/** True if this key is under `limit` requests in the current `windowMs` window (and counts it). */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now >= w.resetAt) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 500) prune(now);
    return true;
  }
  if (w.count >= limit) return false;
  w.count += 1;
  return true;
}

/** The caller key for an inbound request: first hop of x-forwarded-for (Cloud Run sets it). */
export function callerKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : null;
  return ip || "unknown";
}

function prune(now: number) {
  for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
}

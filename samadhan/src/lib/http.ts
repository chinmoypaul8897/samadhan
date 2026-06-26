import "server-only";

// Shared HTTP error envelope for the API routes (C12 hardening). Centralises the code→status
// map that every route hand-rolled as a ternary ladder, so the failure shape is consistent
// everywhere: a route throws an Error whose message is one of the CODES below; the catch calls
// errorResponse(err, tag). Known codes → a 4xx envelope `{ ok:false, error:CODE }`; anything
// unmapped → a logged 500 `{ ok:false, error:"INTERNAL" }` (never leaks a raw message/stack).

export const STATUS_FOR: Record<string, number> = {
  BAD_REQUEST: 400,
  MISSING_PHOTO: 400,
  MISSING_NOTE: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ILLEGAL_TRANSITION: 409,
  STALE_STATUS: 409,
  ISSUE_CLOSED: 409,
  NOT_PREPARED: 409,
  RATE_LIMITED: 429,
};

export function statusForCode(code: string): number {
  return STATUS_FOR[code] ?? 500;
}

/** A `{ ok:false, error }` failure response for a known code (or a 500 for an unknown one). */
export function fail(code: string, extra?: Record<string, unknown>): Response {
  return Response.json({ ok: false, error: code, ...extra }, { status: statusForCode(code) });
}

/**
 * Map a thrown Error to the failure envelope. Logs (with the route tag) only on a 500 — those
 * are the unexpected faults worth seeing; known 4xx codes are control flow, not errors.
 */
export function errorResponse(err: unknown, tag: string): Response {
  const code = err instanceof Error ? err.message : String(err);
  const status = statusForCode(code);
  if (status === 500) console.error(`[${tag}] failed`, err);
  return Response.json({ ok: false, error: status === 500 ? "INTERNAL" : code }, { status });
}

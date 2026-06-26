import "server-only";
import { getAdminAuth } from "@/lib/firebase-admin";

// Officer auth perimeter (backend-plan C8 · A.6 `claims.ts`). The project's first REAL
// server-side identity check: verify the caller's Firebase ID token and read the custom
// claims the C1 seed set (`setCustomUserClaims(uid,{role,authorityId,jurisdictionWards})`).
// Role is a CLAIM, never a client-writable field, so a citizen can't escalate themselves.
//
// This is stricter than C7's demo-grade `/api/internal/transition` (which trusted a uid in
// the body) — the officer portal performs privileged writes (resolve, proof-of-fix), and the
// Storage after-photo rule already requires `request.auth.token.role`, so the officer must be
// a real signed-in account regardless. The citizen endpoints (file / verify-confirm) get the
// same treatment in C12.
//
// Bindings: firebase.google.com/docs/auth/admin/verify-id-tokens + /docs/auth/admin/custom-claims.

export type Officer = {
  uid: string;
  role: "officer" | "admin";
  authorityId: string | null; // admin → null (acts on any authority)
  jurisdictionWards: string[];
};

/** The issue fields jurisdiction needs (server reads the full doc; this is the slice). */
type JurisdictionIssue = { routing?: { authorityId?: string | null } | null };

/** Pull a `Bearer <token>` out of the Authorization header. */
function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : null;
}

/**
 * Verify the caller is a seeded officer/admin. Throws `UNAUTHENTICATED` (no/invalid token)
 * or `FORBIDDEN` (valid token but not staff). Returns the officer's identity + claims.
 */
export async function requireOfficer(req: Request): Promise<Officer> {
  const token = bearer(req);
  if (!token) throw new Error("UNAUTHENTICATED");

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token);
  } catch {
    throw new Error("UNAUTHENTICATED");
  }

  const role = decoded.role as string | undefined;
  if (role !== "officer" && role !== "admin") throw new Error("FORBIDDEN");

  return {
    uid: decoded.uid,
    role,
    authorityId: (decoded.authorityId as string | undefined) ?? null,
    jurisdictionWards: (decoded.jurisdictionWards as string[] | undefined) ?? [],
  };
}

/**
 * Enforce that this officer may act on this issue. Admin passes anything. An officer may act
 * only within their own `authorityId` (which is exactly what the queue filters by). Ward is
 * NOT checked: `jurisdictionWards` is one fixed list shared across all three seed bodies and
 * `issue.ward` is a free-text Google sublocality, so a ward gate would falsely reject (the
 * authority is selected by `defaultAuthorityType`, ward is display-only — C6 D-decision).
 * Throws `FORBIDDEN`.
 */
export function assertJurisdiction(officer: Officer, issue: JurisdictionIssue): void {
  if (officer.role === "admin") return;
  const issueAuthority = issue.routing?.authorityId ?? null;
  if (!issueAuthority || issueAuthority !== officer.authorityId) throw new Error("FORBIDDEN");
}

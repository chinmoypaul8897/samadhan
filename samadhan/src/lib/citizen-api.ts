"use client";

import { getClientAuth } from "@/lib/firebase-client";

// Client for the citizen one-tap endpoints (C12). Every call attaches the citizen's Firebase
// ID token as a Bearer header; the server (claims.ts → requireCitizen) verifies it and reads
// the uid from the token, never the body. Centralised — like officer-api.ts — so no citizen
// fetch can forget the token or fall back to a spoofable body uid. Anonymous citizens have a
// real ID token too, so this works for the default (signed-in-anonymously) session.

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("NOT_SIGNED_IN");
  const token = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res;
}

/** One-tap file the prepared complaint (C6). Throws the server error code on a non-2xx. */
export async function fileComplaint(issueId: string): Promise<void> {
  await authedFetch(`/api/issues/${issueId}/file`, { method: "POST" });
}

/** Confirm (or deny) the officer's resolution (C9). Throws the server error code on a non-2xx. */
export async function confirmVerification(issueId: string, confirmed: boolean): Promise<void> {
  await authedFetch(`/api/issues/${issueId}/verify-confirm`, {
    method: "POST",
    body: JSON.stringify({ confirmed }),
  });
}

/** One-tap send a drafted escalation (C10). Throws the server error code on a non-2xx. */
export async function sendEscalation(issueId: string, escalationId: string): Promise<void> {
  await authedFetch(`/api/issues/${issueId}/escalations/${escalationId}/send`, { method: "POST" });
}

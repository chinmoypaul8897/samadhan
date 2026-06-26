"use client";

import { getClientAuth } from "@/lib/firebase-client";

// Client for the officer API (C8). Every call attaches the officer's Firebase ID token as a
// Bearer header; the server (claims.ts) verifies it + the role claim. Centralised so no
// officer fetch can forget the token.

export type QueueIssue = {
  id: string;
  trackingId: string;
  title: string;
  status: string;
  serviceName: string;
  severity: string;
  hazard: boolean;
  supporterCount: number;
  reportCount: number;
  addressString: string;
  ward: string | null;
  beforeUrl: string | null;
  slaHours: number;
  deadlineMs: number | null;
  createdAtMs: number | null;
};

export type QueueResponse = {
  ok: true;
  authority: { id: string | null; role: string };
  counts: { total: number; byStatus: Record<string, number> };
  issues: QueueIssue[];
};

export type OfficerAction = "acknowledge" | "assign" | "start" | "resolve" | "cannot_fix";

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("NOT_SIGNED_IN");
  const token = await user.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
}

/** Fetch the signed-in officer's support-sorted queue. Throws on a non-2xx. */
export async function fetchQueue(): Promise<QueueResponse> {
  const res = await authedFetch("/api/officer/queue");
  const json = (await res.json()) as QueueResponse | { ok: false; error: string };
  if (!res.ok || !json.ok) throw new Error((json as { error?: string }).error || "QUEUE_FAILED");
  return json;
}

/** Drive an officer action on an issue. Returns the server envelope; never throws on a 4xx. */
export async function officerAction(
  issueId: string,
  body: { action: OfficerAction; note?: string; afterMediaPath?: string },
): Promise<{ ok: boolean; error?: string; from?: string; to?: string; status: number }> {
  const res = await authedFetch(`/api/officer/issues/${issueId}/action`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    from?: string;
    to?: string;
  };
  return { ok: Boolean(json.ok), error: json.error, from: json.from, to: json.to, status: res.status };
}

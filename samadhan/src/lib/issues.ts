"use client";

import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  type Timestamp,
  type GeoPoint,
} from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import type { Severity } from "@/lib/reports";

// issues/{issueId} (data-shapes §6). Created by the intake pipeline (Admin); read here
// (public when isPublic). routing/filing fill in at C6, verification at C9 — so they're
// loose/partial until then.
export type IssueStatus =
  | "submitted"
  | "acknowledged"
  | "assigned"
  | "in_progress"
  | "resolved_pending_verification"
  | "verified_resolved"
  | "cannot_fix"
  | "reopened";

export type Sla = {
  slaHours: number;
  startedAt: Timestamp;
  deadline: Timestamp;
  state: string;
};

// Routing → issue.routing (data-shapes §8.3). Filled by the Route step (C6).
export type Routing = {
  authorityType: "municipal_corporation" | "water_board" | "discom" | "other";
  authorityId: string;
  department: string;
  channel: "app" | "email" | "portal" | "phone" | "whatsapp" | "social";
  confidence: number;
  reasoning: string;
};

// Filing → issue.filing (data-shapes §8.4). Drafted by Act → 'prepared'; the one-tap file
// consent flips it to 'submitted' (+ submittedAt / consentByUid).
export type Filing = {
  status: "draft" | "prepared" | "submitted" | "failed";
  complaintText?: string;
  language?: string;
  format?: string;
  externalRef?: string | null;
  submittedAt?: Timestamp | null;
  consentByUid?: string | null;
};

// Verification → issue.verification (data-shapes §8.6). Seeded at issue-create
// ({required, beforeMediaPath}); the officer resolve (C8) adds afterMediaPath; the agent
// verdict + citizen confirm land in C9. The verdict is advisory — only citizenConfirmed
// (or outcome 'auto') finalises verified_resolved.
export type AiVerdict = {
  resolved: boolean;
  confidence: number;
  reasoning: string;
  gpsMatch: boolean; // visual same-location stand-in (data-shapes §8.6 derivation note)
  timestampMatch: boolean;
  checkedAt?: Timestamp;
};

export type Verification = {
  required: boolean;
  beforeMediaPath: string;
  afterMediaPath?: string | null;
  aiVerdict?: AiVerdict;
  citizenConfirmed?: boolean;
  confirmedByUid?: string | null;
  outcome?: "verified" | "rejected" | "auto";
  finalizedAt?: Timestamp | null;
};

export type IssueDoc = {
  id: string;
  trackingId: string;
  status: IssueStatus;
  statusNotes: string;
  serviceCode: string;
  serviceName: string;
  group: string;
  subCategory?: string | null;
  severity: Severity;
  hazard: boolean;
  title: string;
  description: string;
  location: GeoPoint;
  geohash: string;
  addressString: string;
  ward?: string | null;
  zone?: string | null;
  city?: string | null;
  zipcode?: string | null;
  beforeMedia: { path: string; downloadUrl: string; contentType: string; sizeBytes: number };
  mediaPaths: string[];
  reportCount: number;
  supporterCount: number;
  routing: Routing | null;
  agencyResponsible: string;
  filing?: Filing;
  verification?: Verification;
  sla: Sla;
  escalationLevel: number;
  lastEscalatedAt?: Timestamp | null;
  assignedOfficerUid?: string | null;
  reporterUid: string;
  tags: string[];
  isPublic: boolean;
  resolvedAt?: Timestamp | null;
  verifiedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ActivityItem = {
  id: string;
  type: string;
  message: string;
  actorUid?: string | null;
  fromStatus?: string;
  toStatus?: string;
  createdAt?: Timestamp;
};

// issues/{id}/escalations/{eid} (data-shapes §6). Drafted by the C10 sweep on SLA breach;
// flipped to 'sent' by the citizen's one-tap consent. Read = reporter + staff (rules §12).
export type Escalation = {
  id: string;
  type: "reminder" | "higher_authority_appeal" | "rti_draft" | "social_post";
  status: "drafted" | "approved" | "sent" | "acknowledged";
  channel: string;
  content: string;
  target: string;
  triggerReason: string;
  reasoning?: string;
  approvedByUid?: string | null;
  createdAt?: Timestamp;
  sentAt?: Timestamp | null;
};

/** Live issue (data-shapes §6). undefined = loading, null = not found. */
export function useIssue(issueId: string) {
  const [issue, setIssue] = useState<IssueDoc | null | undefined>(undefined);
  const [error, setError] = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "issues", issueId),
      (snap) => setIssue(snap.exists() ? (snap.data() as IssueDoc) : null),
      (err) => {
        console.error("[useIssue]", err);
        setError(true);
      },
    );
    return () => unsub();
  }, [issueId]);
  return { issue, error };
}

/** Live activity timeline (newest first). */
export function useActivity(issueId: string) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  useEffect(() => {
    const q = query(
      collection(db, "issues", issueId, "activity"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityItem, "id">) }))),
      (err) => console.error("[useActivity]", err),
    );
    return () => unsub();
  }, [issueId]);
  return items;
}

/** Live escalations (newest first) — the agent's drafted reminders/appeals/RTI (C10). */
export function useEscalations(issueId: string) {
  const [items, setItems] = useState<Escalation[]>([]);
  useEffect(() => {
    const q = query(
      collection(db, "issues", issueId, "escalations"),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Escalation, "id">) }))),
      (err) => console.error("[useEscalations]", err),
    );
    return () => unsub();
  }, [issueId]);
  return items;
}

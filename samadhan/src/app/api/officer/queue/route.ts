import { getDb } from "@/lib/firebase-admin";
import { requireOfficer } from "@/lib/claims";
import type { IssueStatus } from "@/lib/status";
import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Officer queue (backend-plan C8.1). requireOfficer → list the officer's authority's ACTIVE
// issues sorted by supporterCount desc (the lever that makes popular problems rise). Uses the
// deployed composite index (routing.authorityId ASC, status ASC, supporterCount DESC) via a
// status `in` query (data-shapes §10). Admin (no authorityId) sees all active authorities.

// "Active" for an officer = anything still needing attention. Excludes the terminal
// verified_resolved + cannot_fix (mirrors the C5 dedup active-set, minus those two).
const ACTIVE_OFFICER: IssueStatus[] = [
  "submitted",
  "acknowledged",
  "assigned",
  "in_progress",
  "resolved_pending_verification",
  "reopened",
];

type QueueIssue = {
  id: string;
  trackingId: string;
  title: string;
  status: IssueStatus;
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

type IssueData = {
  trackingId?: string;
  title?: string;
  status?: IssueStatus;
  serviceName?: string;
  severity?: string;
  hazard?: boolean;
  supporterCount?: number;
  reportCount?: number;
  addressString?: string;
  ward?: string | null;
  beforeMedia?: { downloadUrl?: string };
  sla?: { slaHours?: number; deadline?: { toMillis(): number } };
  createdAt?: { toMillis(): number };
  routing?: { authorityId?: string | null } | null;
};

function toQueueIssue(id: string, d: IssueData): QueueIssue {
  return {
    id,
    trackingId: d.trackingId ?? "",
    title: d.title ?? "Untitled issue",
    status: (d.status ?? "submitted") as IssueStatus,
    serviceName: d.serviceName ?? "",
    severity: d.severity ?? "medium",
    hazard: Boolean(d.hazard),
    supporterCount: d.supporterCount ?? 0,
    reportCount: d.reportCount ?? 0,
    addressString: d.addressString ?? "",
    ward: d.ward ?? null,
    beforeUrl: d.beforeMedia?.downloadUrl ?? null,
    slaHours: d.sla?.slaHours ?? 0,
    deadlineMs: d.sla?.deadline?.toMillis?.() ?? null,
    createdAtMs: d.createdAt?.toMillis?.() ?? null,
  };
}

export async function GET(req: Request) {
  try {
    const officer = await requireOfficer(req);
    const db = getDb();

    let issues: QueueIssue[];
    if (officer.authorityId) {
      // Officer: authority-scoped, status-filtered, support-sorted (composite index).
      const snap = await db
        .collection("issues")
        .where("routing.authorityId", "==", officer.authorityId)
        .where("status", "in", ACTIVE_OFFICER)
        .orderBy("supporterCount", "desc")
        .get();
      issues = snap.docs.map((doc) => toQueueIssue(doc.id, doc.data() as IssueData));
    } else {
      // Admin: all authorities, support-sorted (single-field index), active filtered in code.
      const snap = await db.collection("issues").orderBy("supporterCount", "desc").limit(200).get();
      issues = snap.docs
        .map((doc) => toQueueIssue(doc.id, doc.data() as IssueData))
        .filter((i) => ACTIVE_OFFICER.includes(i.status));
    }

    const byStatus: Record<string, number> = {};
    for (const i of issues) byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;

    return Response.json({
      ok: true,
      authority: { id: officer.authorityId, role: officer.role },
      counts: { total: issues.length, byStatus },
      issues,
    });
  } catch (err) {
    return errorResponse(err, "officer/queue");
  }
}

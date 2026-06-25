"use client";

import { useEffect, useState } from "react";
import {
  GeoPoint,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase-client";
import { geohashOf } from "@/lib/geo";
import {
  downscaleImage,
  uploadReportPhoto,
  type MediaResult,
  type UploadProgress,
} from "@/lib/storage";

// reports/{reportId} — data-shapes.md §5. Client-created (status 'processing', no
// derived keys); the intake pipeline (C3–C6, server/Admin) owns every later write.

export type PipelineStep = "perceive" | "locate" | "dedup" | "route" | "act";
export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";
export type StepTrace = {
  step: PipelineStep;
  status: StepStatus;
  summary: string;
  latencyMs?: number;
  startedAt?: Timestamp;
  finishedAt?: Timestamp;
  error?: string;
};

export type Severity = "low" | "medium" | "high";

// Client mirror of PerceiveOutput (data-shapes §8.1) — set on report.analysis by C3.
export type PerceiveAnalysis = {
  isCivicIssue: boolean;
  confidence: number;
  serviceCode: string;
  serviceName: string;
  subCategory?: string;
  severity: Severity;
  hazard: boolean;
  caption: string;
  ocrText: string | null;
  suggestedTitle: string;
  tags: string[];
  languageDetected: string;
  reasoning: string;
};
export const PIPELINE_STEPS: PipelineStep[] = [
  "perceive",
  "locate",
  "dedup",
  "route",
  "act",
];

export type ReportStatus =
  | "processing"
  | "needs_review"
  | "seeded"
  | "linked"
  | "rejected";

// report.dedup (data-shapes §5) — set by the Dedup step (C5). 'linked' carries the
// matched issue; 'new' means it seeded its own issue.
export type DedupResult = {
  decision: "new" | "linked";
  candidateIssueIds: string[];
  matchedIssueId?: string;
  confidence: number;
  reasoning: string;
};

export type ReportDoc = {
  id: string;
  reporterUid: string;
  channel: "app";
  status: ReportStatus;
  media: MediaResult;
  rawText?: string;
  location: GeoPoint;
  geohash: string;
  accuracyM?: number;
  isSeed: boolean;
  pipeline: StepTrace[];
  analysis?: PerceiveAnalysis;
  dedup?: DedupResult;
  issueId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

function pendingPipeline(): StepTrace[] {
  return PIPELINE_STEPS.map((step) => ({ step, status: "pending", summary: "" }));
}

export type CreateReportInput = {
  uid: string;
  file: File;
  lat: number;
  lng: number;
  accuracyM?: number;
  rawText?: string;
  onProgress?: UploadProgress;
};

// Creates the report doc EXACTLY in the rules-allowed shape and self-enforces the
// C2 gate the rules don't check (id === doc id, GeoPoint, 10-char geohash, 5 pending
// steps). Returns the reportId. Kicks the pipeline fire-and-forget.
export async function createReport(input: CreateReportInput): Promise<string> {
  const { uid, file, lat, lng, accuracyM, rawText, onProgress } = input;

  const reportId = doc(collection(db, "reports")).id;
  const blob = await downscaleImage(file);
  const media = await uploadReportPhoto(uid, reportId, blob, onProgress);

  const geohash = geohashOf(lat, lng);
  if (geohash.length !== 10) {
    throw new Error(`geohash length ${geohash.length}, expected 10`);
  }

  const data: Record<string, unknown> = {
    id: reportId,
    reporterUid: uid,
    channel: "app",
    status: "processing",
    media,
    location: new GeoPoint(lat, lng),
    geohash,
    isSeed: false,
    pipeline: pendingPipeline(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (typeof accuracyM === "number") data.accuracyM = Math.round(accuracyM);
  if (rawText && rawText.trim()) data.rawText = rawText.trim();

  await setDoc(doc(db, "reports", reportId), data);

  // Pipeline kick — frozen as the Genkit-shaped {data:{reportId}} envelope so C3's
  // appRoute(intakeFlow) swap keeps the same request contract. Fire-and-forget: the
  // onSnapshot trace is the real UI driver, so we never depend on the response body.
  void fetch("/api/intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { reportId } }),
  }).catch(() => {});

  return reportId;
}

/** Live "My reports" list (composite index: reporterUid ASC, createdAt DESC). */
export function useMyReports(uid: string | undefined) {
  const [reports, setReports] = useState<ReportDoc[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setError(false);
    const q = query(
      collection(db, "reports"),
      where("reporterUid", "==", uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setReports(snap.docs.map((d) => d.data() as ReportDoc)),
      (err) => {
        console.error("[useMyReports]", err);
        setError(true);
      },
    );
    return () => unsub();
  }, [uid]);

  return { reports, error };
}

/** Live single report (the processing screen). undefined = loading, null = absent. */
export function useReport(reportId: string) {
  const [report, setReport] = useState<ReportDoc | null | undefined>(undefined);
  const [error, setError] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "reports", reportId),
      (snap) => setReport(snap.exists() ? (snap.data() as ReportDoc) : null),
      (err) => {
        console.error("[useReport]", err);
        setError(true);
      },
    );
    return () => unsub();
  }, [reportId]);

  return { report, error };
}

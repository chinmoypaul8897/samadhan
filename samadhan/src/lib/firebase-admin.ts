import "server-only";
import { getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";

// On Cloud Run, the project comes from the metadata server / env (ADC).
const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  undefined;

// Lazy init so a missing-credentials local env never crashes module import.
function ensureApp(): App {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
    storageBucket: PROJECT_ID ? `${PROJECT_ID}.firebasestorage.app` : undefined,
  });
}

export const getDb = () => getFirestore(ensureApp());
export const getBucket = () => getStorage(ensureApp()).bucket();
export const getMsg = () => getMessaging(ensureApp());
export const getAdminAuth = () => getAuth(ensureApp());

/** Lightweight readiness probe for /api/health — never throws. */
export function adminHealth(): { adminReady: boolean; projectId: string | null } {
  try {
    const app = ensureApp();
    const projectId = (app.options.projectId as string | undefined) ?? PROJECT_ID ?? null;
    return { adminReady: Boolean(projectId), projectId };
  } catch {
    return { adminReady: false, projectId: PROJECT_ID ?? null };
  }
}

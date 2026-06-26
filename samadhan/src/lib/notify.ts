import "server-only";
import { getDb, getMsg } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Notify (backend-plan C7.3). Push to a user's FCM web tokens via the Admin SDK
// (sendEachForMulticast) and prune dead tokens. Best-effort — NEVER throws (a failed push
// must not roll back the status transition that triggered it). The Admin SDK authenticates
// to FCM via ADC / the Cloud Run service account (roles/firebasecloudmessaging.admin) — no
// VAPID private key needed server-side; FCM signs the web-push with the project's web-push
// certificate. data values MUST all be strings (FCM constraint).
//
// Bindings: firebase.google.com/docs/cloud-messaging/send/admin-sdk (multicast + prune loop),
// /docs/cloud-messaging/error-codes (the dead-token codes).

const TOKENS_PER_CALL = 500; // FCM hard cap per sendEachForMulticast
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN || "https://samadhan-554128679437.asia-south1.run.app";

/** Absolute HTTPS link to an issue — required for webpush.fcmOptions.link (click target). */
export function issueLink(issueId: string): string {
  return `${APP_ORIGIN}/issue/${issueId}`;
}

export type PushPayload = {
  title: string;
  body: string;
  link?: string; // HTTPS click-through target (webpush.fcmOptions.link)
  data?: Record<string, string | number | boolean | null | undefined>;
};

function stringifyData(data?: PushPayload["data"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

/** Push to one user's devices. Prunes unregistered/invalid tokens. Never throws. */
export async function notifyUser(uid: string, payload: PushPayload): Promise<void> {
  try {
    const db = getDb();
    const userRef = db.collection("users").doc(uid);
    const tokens: string[] = ((await userRef.get()).data()?.fcmTokens as string[]) ?? [];
    if (!tokens.length) return;

    // Notification payload (NOT data-only): the FCM service-worker SDK auto-displays this in
    // the background, since firebase-messaging-sw.js registers NO onBackgroundMessage handler
    // (a handler suppresses auto-display for notification messages → nothing shows; data-only
    // + a handler proved unreliable for background display on Android Chrome). Foreground
    // messages still hit onMessage in the app (→ in-app toast). Click target = fcmOptions.link.
    const base = {
      notification: { title: payload.title, body: payload.body },
      data: stringifyData(payload.data),
      webpush: {
        headers: { Urgency: "high" },
        fcmOptions: payload.link ? { link: payload.link } : undefined,
        notification: { icon: "/icon-192.png", badge: "/icon-192.png" },
      },
    };

    const dead: string[] = [];
    for (let i = 0; i < tokens.length; i += TOKENS_PER_CALL) {
      const batch = tokens.slice(i, i + TOKENS_PER_CALL);
      const resp = await getMsg().sendEachForMulticast({ ...base, tokens: batch });
      if (resp.failureCount > 0) {
        resp.responses.forEach((r, idx) => {
          if (!r.success && r.error?.code && DEAD_TOKEN_CODES.has(r.error.code)) {
            dead.push(batch[idx]); // index-aligned to the tokens we sent
          }
        });
      }
    }

    if (dead.length) {
      await userRef.update({ fcmTokens: FieldValue.arrayRemove(...dead) }).catch(() => {});
    }
  } catch (err) {
    console.error("[notify] notifyUser failed", uid, err);
  }
}

/** Convenience: push to an issue's seed reporter. Never throws. */
export async function notifyReporter(issueId: string, payload: PushPayload): Promise<void> {
  try {
    const reporterUid = (await getDb().collection("issues").doc(issueId).get()).data()
      ?.reporterUid as string | undefined;
    if (reporterUid) await notifyUser(reporterUid, payload);
  } catch (err) {
    console.error("[notify] notifyReporter failed", issueId, err);
  }
}

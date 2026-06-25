"use client";

import {
  isSupported,
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
  type MessagePayload,
} from "firebase/messaging";
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { db, firebaseApp } from "@/lib/firebase-client";

// Client FCM web-push helper (C7). isSupported()-gated everywhere (false on iOS Safari web,
// Firefox private, no-IndexedDB). Permission → getToken({ vapidKey, serviceWorkerRegistration })
// → store the token on the user's own users/{uid}.fcmTokens (the citizen update rule allows a
// non-role field write, so no server route is needed — pruning of dead tokens happens
// server-side in notify()). Foreground messages go to listenForeground (the SW only handles
// background). Bindings: firebase.google.com/docs/cloud-messaging/js/client + /web/receive-messages.

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const SW_URL = "/firebase-messaging-sw.js";

export type EnableResult =
  | { status: "enabled"; token: string }
  | { status: "unsupported" }
  | { status: "denied" }
  | { status: "no-key" }
  | { status: "error"; message: string };

let messagingSingleton: Messaging | null = null;

async function getClientMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;
  try {
    if (!(await isSupported())) return null;
  } catch {
    return null;
  }
  if (!messagingSingleton) messagingSingleton = getMessaging(firebaseApp);
  return messagingSingleton;
}

/** True when this browser can do web push at all (gate the opt-in UI on it). */
export async function notificationsSupported(): Promise<boolean> {
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

async function registerSw(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) return undefined;
  // Explicit registration (and passed to getToken) so the FCM SW doesn't fight /sw.js for
  // the root scope.
  return navigator.serviceWorker.register(SW_URL);
}

/** Request permission, mint an FCM token, and store it on the user's own doc. */
export async function enableNotifications(uid: string): Promise<EnableResult> {
  try {
    const messaging = await getClientMessaging();
    if (!messaging) return { status: "unsupported" };
    if (!VAPID_KEY) return { status: "no-key" }; // VAPID key not baked yet

    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { status: "denied" };

    const serviceWorkerRegistration = await registerSw();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration });
    if (!token) return { status: "error", message: "no_token" };

    await updateDoc(doc(db, "users", uid), {
      fcmTokens: arrayUnion(token),
      updatedAt: serverTimestamp(),
    });
    return { status: "enabled", token };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "messaging/permission-blocked" || code === "messaging/permission-default") {
      return { status: "denied" };
    }
    return { status: "error", message: (err as Error).message };
  }
}

/** Subscribe to FOREGROUND messages (the SW only fires when the app is backgrounded). */
export async function listenForeground(cb: (payload: MessagePayload) => void): Promise<() => void> {
  const messaging = await getClientMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, cb);
}

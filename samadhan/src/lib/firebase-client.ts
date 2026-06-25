import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Public client config — inlined at build from NEXT_PUBLIC_* (not secret by design).
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Firestore + Storage handles are safe to construct at module load.
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// getAuth() validates the API key eagerly and throws when it's absent — which is
// the case during SSR/prerender (no NEXT_PUBLIC_* at build). Construct it lazily
// so it only ever runs in the browser, where the inlined config is present.
let authInstance: Auth | null = null;
export function getClientAuth(): Auth {
  if (!authInstance) authInstance = getAuth(firebaseApp);
  return authInstance;
}

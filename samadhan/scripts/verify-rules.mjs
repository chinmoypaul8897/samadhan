// Automated proof of the C1 security gate (done-when #2): a signed-in client must
// NOT be able to (a) write an issues doc or (b) escalate its own role to officer.
// Uses the client SDK + NEXT_PUBLIC_* config (loaded from .env.local).
//
// Run:  node scripts/verify-rules.mjs   (after rules deploy + Anonymous Auth on)

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Minimal .env.local loader (Node doesn't read it automatically).
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* no .env.local — rely on the ambient environment */
}

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!config.apiKey || !config.projectId) {
  console.error("Missing NEXT_PUBLIC_FIREBASE_* config — set .env.local first.");
  process.exit(1);
}

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const isDenied = (err) =>
  err?.code === "permission-denied" ||
  /PERMISSION_DENIED|insufficient permissions/i.test(String(err?.message));

async function expectDenied(label, fn) {
  try {
    await fn();
    console.error(`  ✗ ${label}: SUCCEEDED — rules too permissive!`);
    return false;
  } catch (err) {
    if (isDenied(err)) {
      console.log(`  ✓ ${label}: denied`);
      return true;
    }
    console.error(`  ✗ ${label}: unexpected error — ${err?.code ?? err}`);
    return false;
  }
}

async function main() {
  const { user } = await signInAnonymously(auth);
  console.log(`Signed in anonymously as ${user.uid}`);

  const denyIssues = await expectDenied("client write to issues", () =>
    setDoc(doc(db, "issues", `deny_test_${user.uid}`), {
      title: "should-fail",
      isPublic: true,
      createdAt: serverTimestamp(),
    }),
  );

  // Establish the (allowed) citizen doc so the next call is a true escalation attempt.
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      role: "citizen",
      displayName: "Anonymous Citizen",
      isAnonymous: true,
      languagePref: "en",
      fcmTokens: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    },
    { merge: true },
  );

  const denyEscalate = await expectDenied("self-escalate role to officer", () =>
    updateDoc(doc(db, "users", user.uid), { role: "officer" }),
  );

  if (denyIssues && denyEscalate) {
    console.log("PASS — security perimeter holds.");
    process.exit(0);
  }
  console.error("FAIL — a deny-test did not behave as expected.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

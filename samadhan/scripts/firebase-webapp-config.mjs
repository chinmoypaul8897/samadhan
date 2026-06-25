// Ensure a Firebase Web App exists and write its public config into .env.local
// (NEXT_PUBLIC_FIREBASE_*). Uses the Firebase Management REST API with a gcloud
// ADC token (GAUTH_TOKEN) — no firebase CLI.
//
// Usage:  GAUTH_TOKEN=$(gcloud auth application-default print-access-token) \
//         GOOGLE_CLOUD_PROJECT=<proj> node scripts/firebase-webapp-config.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const proj = process.env.GOOGLE_CLOUD_PROJECT || "samadhan-civic-7k4m2";
const token = process.env.GAUTH_TOKEN;
if (!token) {
  console.error("Set GAUTH_TOKEN (gcloud auth application-default print-access-token).");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://firebase.googleapis.com/v1beta1";
const headers = {
  Authorization: `Bearer ${token}`,
  "x-goog-user-project": proj,
  "Content-Type": "application/json",
};

async function api(method, url, body) {
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ensureWebApp() {
  const list = await api("GET", `${base}/projects/${proj}/webApps`);
  if (list.apps?.length) {
    console.log(`Reusing web app ${list.apps[0].appId}`);
    return list.apps[0].appId;
  }
  console.log("Creating web app …");
  let op = await api("POST", `${base}/projects/${proj}/webApps`, { displayName: "Samadhan PWA" });
  for (let i = 0; i < 30 && !op.done; i++) {
    await sleep(2000);
    op = await api("GET", `${base}/${op.name}`);
  }
  if (op.error) throw new Error(JSON.stringify(op.error));
  return op.response.appId;
}

function writeEnvLocal(cfg) {
  const file = join(root, ".env.local");
  const wanted = {
    NEXT_PUBLIC_FIREBASE_API_KEY: cfg.apiKey,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: cfg.authDomain,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: cfg.projectId,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: cfg.storageBucket || `${proj}.firebasestorage.app`,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: cfg.messagingSenderId,
    NEXT_PUBLIC_FIREBASE_APP_ID: cfg.appId,
  };
  const lines = existsSync(file) ? readFileSync(file, "utf8").split(/\r?\n/) : [];
  const seen = new Set();
  const out = lines.map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m && m[1] in wanted) {
      seen.add(m[1]);
      return `${m[1]}=${wanted[m[1]]}`;
    }
    return line;
  });
  for (const [k, v] of Object.entries(wanted)) {
    if (!seen.has(k)) out.push(`${k}=${v}`);
  }
  writeFileSync(file, out.filter((l, i) => !(l === "" && i === out.length - 1)).join("\n") + "\n");
  console.log(`Wrote NEXT_PUBLIC_FIREBASE_* → ${file}`);
}

async function main() {
  const appId = await ensureWebApp();
  const cfg = await api("GET", `${base}/projects/${proj}/webApps/${appId}/config`);
  console.log(JSON.stringify({ ...cfg, apiKey: cfg.apiKey ? "(set)" : "(missing)" }, null, 2));
  writeEnvLocal(cfg);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

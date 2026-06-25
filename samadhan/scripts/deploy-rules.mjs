// Deploy a security rules file via the Firebase Rules REST API (no firebase CLI).
// Auth: a gcloud ADC access token passed in GAUTH_TOKEN; quota project via header.
//
// Usage:  GAUTH_TOKEN=$(gcloud auth application-default print-access-token) \
//         GOOGLE_CLOUD_PROJECT=<proj> node scripts/deploy-rules.mjs <file> <release>
//   e.g.  ... deploy-rules.mjs firestore.rules cloud.firestore
//   e.g.  ... deploy-rules.mjs storage.rules  firebase.storage/<bucket>   (C2)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const proj = process.env.GOOGLE_CLOUD_PROJECT || "samadhan-civic-7k4m2";
const token = process.env.GAUTH_TOKEN;
const fileArg = process.argv[2] || "firestore.rules";
const releaseId = process.argv[3] || "cloud.firestore";

if (!token) {
  console.error("Set GAUTH_TOKEN (gcloud auth application-default print-access-token).");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rulesText = readFileSync(join(root, fileArg), "utf8");
const base = `https://firebaserules.googleapis.com/v1/projects/${proj}`;
const headers = {
  Authorization: `Bearer ${token}`,
  "x-goog-user-project": proj,
  "Content-Type": "application/json",
};

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`${method} ${url} → ${res.status}\n${text}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  const ruleset = await api("POST", `${base}/rulesets`, {
    source: { files: [{ name: fileArg, content: rulesText }] },
  });
  console.log(`ruleset: ${ruleset.name}`);

  const releaseName = `projects/${proj}/releases/${releaseId}`;
  try {
    const r = await api("POST", `${base}/releases`, {
      name: releaseName,
      rulesetName: ruleset.name,
    });
    console.log(`release created → ${r.rulesetName}`);
  } catch (err) {
    if (err.status !== 409) throw err;
    const r = await api("PATCH", `${base}/releases/${releaseId}`, {
      release: { name: releaseName, rulesetName: ruleset.name },
    });
    console.log(`release updated → ${r.rulesetName}`);
  }
  console.log(`Deployed ${fileArg} → ${releaseId}.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

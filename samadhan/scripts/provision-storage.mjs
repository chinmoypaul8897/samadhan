// Provision the default Cloud Storage for Firebase bucket (PROJECT.firebasestorage.app)
// via the firebasestorage REST API — no firebase CLI. Idempotent.
// Bound to: firebase.google.com/docs/reference/rest/storage (projects.defaultBucket.create).
// Requires the Blaze plan (verified billingEnabled on this project).
//
// Run:  GAUTH_TOKEN=$(gcloud auth application-default print-access-token) \
//       GOOGLE_CLOUD_PROJECT=<proj> node scripts/provision-storage.mjs

const proj = process.env.GOOGLE_CLOUD_PROJECT || "samadhan-civic-7k4m2";
const token = process.env.GAUTH_TOKEN;
const location = process.env.STORAGE_LOCATION || "asia-south1";

if (!token) {
  console.error("Set GAUTH_TOKEN (gcloud auth application-default print-access-token).");
  process.exit(1);
}

const base = `https://firebasestorage.googleapis.com/v1beta/projects/${proj}`;
const headers = {
  Authorization: `Bearer ${token}`,
  "x-goog-user-project": proj,
  "Content-Type": "application/json",
};

async function main() {
  // Already provisioned?
  const getRes = await fetch(`${base}/defaultBucket`, { headers });
  if (getRes.ok) {
    const d = await getRes.json();
    if (d?.bucket?.name) {
      console.log(`default bucket already exists: ${d.bucket.name}`);
      return;
    }
  }

  // location is REQUIRED + immutable; name is auto-derived as PROJECT.firebasestorage.app.
  const res = await fetch(`${base}/defaultBucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ location }),
  });
  const text = await res.text();

  if (res.ok) {
    console.log(`created default bucket @ ${location}: ${text}`);
    return;
  }
  if (res.status === 409 || /ALREADY_EXISTS/i.test(text)) {
    console.log("default bucket already exists.");
    return;
  }
  console.error(`POST defaultBucket → ${res.status}\n${text}`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

# Runbook — C0b: Cloud bring-up (Google Cloud)

Run these once to take C0 to its full gate (live Cloud Run URL + `/api/health` `adminReady:true` + budget alert). `gcloud`/`firebase` aren't installed on the build machine, so do this from your machine (install the CLIs) or **Google Cloud Shell** (both preinstalled, easiest).

Replace `PROJECT_ID` throughout. Region is `asia-south1` (Mumbai).

> **Note:** C0b deliberately needs **no `NEXT_PUBLIC_*` build values** — the landing + health route only need a runtime project id. Firebase web config + Maps key get wired in C1.

---

## 0. Tools (skip if using Cloud Shell)
```bash
# gcloud: https://cloud.google.com/sdk/docs/install   firebase: npm i -g firebase-tools
gcloud auth login
firebase login
```

## 1. Project + billing
```bash
gcloud projects create PROJECT_ID --name="Samadhan"        # or reuse an existing one
gcloud config set project PROJECT_ID
# Link billing (needed for Cloud Run/Build). List accounts, then link:
gcloud billing accounts list
gcloud billing projects link PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

## 2. Enable APIs
```bash
gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firestore.googleapis.com firebasestorage.googleapis.com \
  secretmanager.googleapis.com generativelanguage.googleapis.com \
  geocoding-backend.googleapis.com maps-backend.googleapis.com \
  cloudscheduler.googleapis.com identitytoolkit.googleapis.com
```

## 3. Firebase (Firestore native, Storage, Auth)
```bash
firebase projects:addfirebase PROJECT_ID
gcloud firestore databases create --location=asia-south1        # native mode
# Storage default bucket:
gcloud storage buckets create gs://PROJECT_ID.firebasestorage.app --location=asia-south1
```
Then in the Firebase console → Authentication → Sign-in method → **enable Anonymous** (used in C1).

## 4. Gemini key → Secret Manager
Get a key from Google AI Studio (aistudio.google.com → Get API key), then:
```bash
printf '%s' 'YOUR_GEMINI_API_KEY' | gcloud secrets create GEMINI_API_KEY --data-file=-
```

## 5. Runtime service account + IAM
```bash
gcloud iam service-accounts create samadhan-run --display-name="Samadhan Cloud Run"
SA="samadhan-run@PROJECT_ID.iam.gserviceaccount.com"
for ROLE in roles/datastore.user roles/storage.objectAdmin \
            roles/firebasecloudmessaging.admin roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding PROJECT_ID --member="serviceAccount:$SA" --role="$ROLE"
done
```

## 6. Deploy (Cloud Build builds the Dockerfile in ./samadhan)
```bash
gcloud run deploy samadhan \
  --source ./samadhan \
  --region asia-south1 \
  --allow-unauthenticated \
  --service-account "$SA" \
  --set-env-vars GOOGLE_CLOUD_PROJECT=PROJECT_ID \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```
Copy the printed **Service URL**.

## 7. Budget alert (safety net)
```bash
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="Samadhan cap" \
  --budget-amount=5USD \
  --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0
```
(Or Console → Billing → Budgets & alerts.)

## 8. Verify the gate
```bash
curl -s https://SERVICE_URL/api/health        # expect: {"ok":true,...,"adminReady":true}
```
Open `https://SERVICE_URL/` — landing renders; install-to-home-screen offered.

## 9. GitHub visibility
Confirm `github.com/chinmoypaul8897/samadhan` is set to **Public** (Settings → General → Danger Zone → Change visibility) — it's a submission requirement.

---

**C0 done when:** Service URL serves the landing, `/api/health` returns `adminReady:true` with the real project id, repo is public, budget alert active. Then we start C1 (auth + rules + seed).

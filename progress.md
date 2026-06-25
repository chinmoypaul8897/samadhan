# progress.md — Running Log (reality)

> Newest first. The **Current State** block is the 5-second catch-up for the next chunk. Plans live in the spec files; this is what *actually* happened (incl. every deviation).

## Current State
- **Phase:** Core · **Chunk:** **C3 COMPLETE ✅** (local gate green — Perceive classifies a photo live via Gemini 2.5 Flash). **Next: C4 (Locate + create seed issue + start SLA).**
- **Model path:** **Vertex AI (ADC) · asia-south1 · gemini-2.5-flash** — NOT the Gemini Developer-API key. The user's `AQ.…` key is valid but the Developer API is billing-gated on this project (`429 prepayment credits depleted`), so we use Vertex (verified 200 OK, no key, bills pay-as-you-go — pennies, under ₹400). `aiplatform.googleapis.com` enabled. Genkit: `vertexAI({location:'asia-south1'})`.
- **C3 verified (local, headless, real Commons photos):** pothole → `isCivicIssue:true`, conf 0.95, `serviceCode:pothole`, severity high, hazard true, perceive **done 8.5s**, `report.analysis` written, status `processing`; cat → `rejected`. `/api/intake` = `appRoute(intakeFlow)`, frozen `{data:{reportId}}` body.
- **⚠ C3b BLOCKED on ONE IAM grant (needs your OK):** the live flow needs `roles/aiplatform.user` on the `samadhan-run` SA (auto-mode blocked me granting it). Until then the **live URL still serves C2** (rev `samadhan-00002`); local is fully working. Grant → I rebuild+redeploy (`:c3`) and the live agent works. Command in the C3 log below.
- **C2 live state:** Storage bucket `samadhan-civic-7k4m2.firebasestorage.app` (asia-south1) + CORS + `storage.rules` deployed. Capture: `/report` → `createReport` → `/report/[id]` live console → `/me`.
- **C1 live state:** Anonymous Auth ON; `firestore.rules` + 7 composite indexes; seed now **`serviceCatalog`(9, incl. `other`)** + `authorities`(3) + 4 staff. Web config → `samadhan/.env.local` (+ `GOOGLE_CLOUD_PROJECT`); officer/admin creds → `scripts/seed-output.local.json` (gitignored).
- **Build/deploy:** AR repo `samadhan`; `cloudbuild.yaml` builds+pushes with NEXT_PUBLIC_* `--build-arg`; **owner runs `gcloud run deploy --image`** separately (CB-SA lacks run.admin; not granted).
- **Toolchain:** node v24, git, Docker; `gcloud` at `C:\Users\chinm\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin` (prepend PATH; PowerShell). firebase CLI NOT installed — cloud ops via gcloud + ADC + REST (`x-goog-user-project` header). Helpers: `deploy-rules.mjs`, `firebase-webapp-config.mjs`, `provision-storage.mjs`. Genkit Dev UI: `genkit start` (genkit-cli installed).
- **Dev-server port:** **3030** (pinned in `npm run dev`).
- **Playwright MCP:** connects (√) but tools still **NOT loaded this session** → C3 verified headless. Restart for browser tools → screenshot the live console.
- **Carried forward:** owner-auth on the flow → C12; `enableFirebaseTelemetry` → later observability; voice → C13; interactive map-pin → C4.

---

## Log

### C3 — Perceive (Genkit + Gemini vision) + live trace — COMPLETE ✅ (local gate green)
**Bindings verified first (background workflow · 4 agents · high-confidence):** Genkit **1.38.0** (all `@genkit-ai/*` in lockstep; use `@genkit-ai/google-genai`, not the deprecated `googleai`); `ai.generate({output:{schema}})` → `.output` is parsed-or-**null** (no throw); vision + structured output work together on gemini-2.5-flash via `prompt:[{media:{url:dataURL}},{text}]`; `appRoute` reads `{data:input}` (our frozen body is correct); must externalise genkit + otel + handlebars or Turbopack breaks. Adversarial review caught + we fixed: serverExternalPackages, whole-array pipeline write, idempotency guard, serviceCode validation, the missing reject UI.

**Model-path change (the big one):** the user minted a Gemini **Developer-API** key (`AQ.…`) — valid, but the project is billing-gated → `429 "prepayment credits depleted"` (free tier not applying). Verified **Vertex AI** (same gemini-2.5-flash, ADC, **no key**) returns 200 in asia-south1 → **switched C3 to `vertexAI({location:'asia-south1'})`**, enabled `aiplatform.googleapis.com`. Bills pay-as-you-go (pennies; under ₹400). Deviates from backend-plan A.2 (`googleAI()`+GEMINI_API_KEY) — logged.

**Built (4 commits):** genkit 1.38 deps; `genkit/index.ts` (Vertex), `schemas.ts` (zod PerceiveOutput), `lib/retry.ts`; `steps/perceive.ts` (Admin image download → conditional sharp downscale → data URL → `ai.generate` → **catalogue-validate serviceCode**, coerce unlisted→`other`); `flows/intake.ts` (idempotency guard, `ai.run('perceive')` span, **whole-array pipeline write with `Timestamp.now()`** — serverTimestamp can't sit inside arrays — + reject / needs_review paths); `/api/intake` = `appRoute(intakeFlow)`; dark `PipelineSteps` console + `ProcessingView` result card + terminal states; `next.config` serverExternalPackages; `.env.local` `GOOGLE_CLOUD_PROJECT`.

**Verified (local, headless, real Commons photos):** pothole → isCivicIssue true / 0.95 / pothole / high / hazard, perceive done 8.5s, `analysis` written; cat → `rejected`, isCivicIssue false. `npm run build` clean.

**Deviations / decisions:**
- **Vertex AI, not the Developer-API key** (billing-gated) — ADC, no Secret Manager. Cost: pay-as-you-go, pennies at demo volume, under ₹400 (not a literal "free tier").
- **Owner-auth deferred to C12** — the kick stays header-less; the report doc is already read-owner-only + update-server-only, and only the creator holds the reportId.
- **`enableFirebaseTelemetry` dropped** from C3 (Monitoring/Trace IAM + log-spam risk; the Dev UI span needs no telemetry plugin).
- **Added `other` serviceCatalog doc** (the §8.1 "else other" needs a real catalogue entry for C4/C6 lookup).
- **Conditional sharp downscale** (only if >2 MB / non-JPEG; the C2 client already ships ~1280 px). HEIC → falls back to original.

**C3b — gated on ONE IAM grant (auto-mode blocked; needs the founder to authorise):**
```
gcloud projects add-iam-policy-binding samadhan-civic-7k4m2 \
  --member="serviceAccount:samadhan-run@samadhan-civic-7k4m2.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user" --condition=None
```
Then I rebuild+redeploy (`cloudbuild.yaml` `_TAG=c3` → `gcloud run deploy --image …:c3`) so the LIVE flow calls Vertex. Local gate already green. **Pending session restart:** Playwright screenshot of the live console.

### C2 — Capture → upload → create report — COMPLETE ✅ (gate green)
**Bindings verified first (background research workflow · 4 agents):** firebasestorage `projects.defaultBucket.create` (location asia-south1, one-step create+link, Blaze-gated — billing confirmed Blaze); Storage web `uploadBytesResumable` + **mandatory bucket CORS**; geofire `geohashForLocation` (10-char) / `distanceBetween` (km×1000); `gcloud run deploy --source` has **no** `--build-arg` → Cloud Build + substitutions. An adversarial review caught a bucket-name blocker (`.appspot` vs `.firebasestorage.app`) + 3 gaps, all fixed before building.

**C2a (code · 3 commits):**
- `geofire-common`; `lib/geo.ts`, `lib/storage.ts` (resumable upload + defensive ~1280px downscale → original on decode failure), `lib/reports.ts` (`createReport` self-enforces the gate the rules don't; `useMyReports`/`useReport`).
- `/report` CaptureFlow (photo + auto-GPS + note, all states); `/report/[id]` ProcessingView (5-step `PipelineSteps` = the C3 seam); `/me` live list; `/api/intake` stub.
- dev port pinned 3030.

**C2b (cloud · gcloud + ADC + REST):**
- Provisioned default bucket `samadhan-civic-7k4m2.firebasestorage.app` (`provision-storage.mjs`).
- Applied bucket CORS (`cors.json`); deployed `storage.rules` (release `firebase.storage/<bucket>` via `deploy-rules.mjs`).
- Built+pushed image with NEXT_PUBLIC_* `--build-arg` (Cloud Build · AR repo `samadhan` · tag `:c2`); deployed rev `samadhan-00002` → **live URL now serves C2** (resolves C1's deferred redeploy).
- Verified headless: report-doc gate PASS + cross-uid storage write denied.

**Deviations / decisions:**
- **GPS-denied = block-until-GPS + retry** (no fake coordinate — would corrupt dedup/routing/map). Interactive map-pin fallback → C4.
- **`/api/intake` request contract frozen** as Genkit `{data:{reportId}}`; C2 ships a stub, C3 swaps the handler internals only. Kick is fire-and-forget (onSnapshot drives the UI).
- **Defensive downscale** (~1280px; C3 spec says ~1024 for Gemini — re-tune there) with original-file fallback for HEIC.
- **`cloudbuild.yaml` = build+push only**, owner runs deploy — the in-build deploy step needs `run.admin` on the Cloud Build SA, an IAM grant that auto-mode **denied** (unauthorised) and isn't needed.
- **CORS verified via config** (`buckets describe`); real-browser upload pending the Playwright session restart.
- **Cost note:** the default bucket is in **asia-south1**, which is **not** in GCS's Always-Free tier (only US-CENTRAL1/EAST1/WEST1 are) → Storage bills against the ₹400 budget. Trivial at demo volume, but not free.

### C1 — Auth + rules + indexes + seed — COMPLETE ✅ (gate green)
**C1a (code · 5 commits):**
- `firestore.rules` + `storage.rules` + `firestore.indexes.json` (7 composites) + `firebase.json`/`.firebaserc`.
- Anonymous auth + `AuthProvider` (ensures the citizen `users/{uid}` doc); `firebase-client` gains `db`/`storage` + lazy `getClientAuth()`.
- App shell: `TopBar` (wordmark · EN/हि toggle · profile), `BottomNav` + deep-green Report FAB, `AppShell` hides chrome on `/report`.
- `/` repurposed into the in-shell citizen home with the live `serviceCatalog` category grid (loading/empty/error states); `/me` Activity stub.
- `scripts/seed.mjs` (idempotent) + `scripts/verify-rules.mjs` (automated deny-test).

**C1b (cloud · fully automated via gcloud + ADC + Firebase REST; no firebase CLI):**
- Enabled `firebaserules` API. First seed wrote catalog+authorities, then `createUser` hit `CONFIGURATION_NOT_FOUND` → **Firebase Auth had never been initialized**.
- Initialised Identity Platform (`POST identitytoolkit.googleapis.com/v2/projects/{p}/identityPlatform:initializeAuth`), then enabled the Anonymous provider (`admin/v2/.../config` PATCH, `signIn.anonymous.enabled=true`).
- Re-ran seed → 4 staff accounts. Deployed `firestore.rules` via the Firebase Rules API (`scripts/deploy-rules.mjs`). Created the 7 composites via gcloud (all **READY**). Created the Web App + wrote `.env.local` (`scripts/firebase-webapp-config.mjs`).
- Verified live: `verify-rules.mjs` **PASS**; anonymous client reads 8 categories + 3 authorities.

**Deviations / discoveries:**
- **D1 storage path:** standardised on uid-scoped `reports/{uid}/{reportId}/...` (only enforceable form) and fixed `data-shapes.md` §7 to match. (Plan-approved.)
- **Firebase Auth needs explicit init** — enabling the `identitytoolkit` API does *not* create the config; `initializeAuth` is required first. Key C1b discovery.
- **ADC + REST** needs the `x-goog-user-project` header or APIs 403 with a wrong-consumer "SERVICE_DISABLED".
- **`getAuth` made lazy** (`getClientAuth`) — eager `getAuth` threw `auth/invalid-api-key` during prerender (no `NEXT_PUBLIC_*` at build).
- **PowerShell unfit for the Rules REST POST** — `Out-File utf8` BOM + `ConvertTo-Json` escaping → 400/curl-56. Moved rules + webapp REST into Node `fetch` scripts (clean JSON + readable error bodies). Reusable for storage rules in C2.
- **`/` repurposed** to the in-shell home (C0 marketing hero → `/dashboard` at C11). **No `tailwind.config.ts`** (Tailwind v4 `@theme`), unchanged from C0.
- **Officers/admin are real Auth accounts** (email/password + custom claims) so the C8 portal has working logins; creds gitignored.

**Deferred to C2:** Storage bucket + `storage.rules` deploy; live Cloud Run redeploy with web config (Dockerfile `ARG NEXT_PUBLIC_*` staged). **Pending session restart:** Playwright visual screenshot of the signed-in shell.

### C0b — Cloud bring-up — COMPLETE ✅ (C0 gate green)
- User authenticated gcloud as **hello.chinmoypaul@gmail.com**; I ran everything else via the PowerShell tool.
- Project **`samadhan-civic-7k4m2`** created; billing **`01AE04-426C34-CF6314`** (INR) linked; ADC quota project set.
- APIs enabled: run, cloudbuild, artifactregistry, firestore, storage, firebasestorage, firebase, secretmanager, identitytoolkit, generativelanguage, geocoding/maps, cloudscheduler, billingbudgets.
- **Firestore** `(default)` native @ asia-south1 (free tier). **SA** `samadhan-run` + roles (datastore.user, storage.objectAdmin, firebasecloudmessaging.admin, secretmanager.secretAccessor).
- **Deployed** to Cloud Run via Cloud Build (`./samadhan` Dockerfile): **https://samadhan-554128679437.asia-south1.run.app** (rev samadhan-00001, 512Mi, max-instances 3, `--allow-unauthenticated`, env `GOOGLE_CLOUD_PROJECT`).
- **Verified live:** `/api/health` → `{ok:true, projectId:"samadhan-civic-7k4m2", adminReady:true}`; `/`, `/report`, `/manifest.webmanifest`, `/icon-192/512.png` all **200**. GitHub repo **public** ✓. Budget alert **₹400** (50/90/100%) ✓.
- **Deferred to their chunks:** Storage bucket + Anonymous Auth → C1; Gemini key → Secret Manager in C3 (no AI in C0).
- **Op note:** `gcloud` not on tool PATH → prepend `C:\Users\chinm\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin`; run via PowerShell tool. Bash git push uses cached GitHub creds.

### C0 — Foundation  *(started)*
**Decisions / deviations:**
- App scaffolded into `samadhan/` subfolder; planning docs stay at repo root (CLAUDE.md must be root for auto-load). Repo named `samadhan`; app dir also `samadhan/` (harmless nesting).
- C0 split into **C0a** (local, buildable now) and **C0b** (cloud, gated on the user's Google account / CLIs) — agreed in plan-mode to avoid a blocked gate.
- Dockerfile base **node:24-slim** to match local node 24 (plan said node:22; bumped to avoid build/runtime drift).
- Install **only C0 deps** (next, react, tailwind, firebase, firebase-admin, server-only, framer-motion, lucide-react); `genkit`/`geofire-common`/`google-auth-library` deferred to their chunks (+ added to `serverExternalPackages` then).
- `/api/health` returns `adminReady:false` locally (no ADC) and `true` on Cloud Run — graceful by design.
- Brand icons are placeholders for C0; polished in C12.

**More deviations found during build:**
- Scaffold is **Next.js 16.2.9 / React 19.2 / Tailwind v4** → tokens via `@theme` in `globals.css`, **no `tailwind.config.ts`** (frontend-plan §A.5 assumed one).
- `firebase-admin` exposed as **lazy getters** (`getDb`/`getBucket`/`getMsg`) + `adminHealth()` instead of eager `export const db` (avoids crash on missing local creds).
- Added **`sharp`** (icon generation; reused for C3 image downscaling). Added `motion` + `lucide-react`.
- create-next-app dropped its own `CLAUDE.md`/`AGENTS.md` in `samadhan/` → **removed** (would clash with the root constitution). It also gitignores `next-env.d.ts` and `.env*` (used `git add -f` for `.env.example`).
- Animation lib chosen: **`motion`** (the renamed Framer Motion) — not yet used in C0 (landing uses CSS `fade-up`).
- **C0b deploy needs no build-time `NEXT_PUBLIC_*`** — landing+health only need a runtime project id; Firebase web config wired in C1.

**Built & verified (C0a):**
- `npm run build` ✓ (Turbopack, TS clean) — routes: `/`, `/report`, `/api/health` (ƒ), `/manifest.webmanifest`, `/icon.png`.
- Standalone server probe: `/api/health` → `{ok:true, adminReady:false}` (correct locally), home/report/manifest **200**. (`icon-192` 404 only in the in-place standalone run — `public/` not copied; the Dockerfile copies it, so it serves on Cloud Run.)
- **Docker image not built locally** — Docker Desktop daemon is off; Cloud Build builds it during `gcloud run deploy` (C0b). Dockerfile follows the verified Next-standalone contract.
- History: 6 atomic commits, pushed to `origin/main`.

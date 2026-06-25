# progress.md — Running Log (reality)

> Newest first. The **Current State** block is the 5-second catch-up for the next chunk. Plans live in the spec files; this is what *actually* happened (incl. every deviation).

## Current State
- **Phase:** Foundation · **Chunk:** **C1 COMPLETE ✅** (gate green — auth + rules + indexes + seed all live & verified). **Next: C2 (capture → upload → create report).**
- **Live cloud:** project `samadhan-civic-7k4m2` · region asia-south1 · Cloud Run https://samadhan-554128679437.asia-south1.run.app (still serving the C0/C1 landing — the client redeploy with web config is a C2 task, see Deferred).
- **C1 live state:** Firebase Auth initialized + **Anonymous provider ON**; `firestore.rules` deployed; **7 composite indexes READY**; seed loaded — `serviceCatalog`(8) + `authorities`(3: BBMP/BWSSB/BESCOM) + 4 staff (3 officers + admin). Verified live: deny-test PASS (client `issues` write + role-escalation both denied), anonymous catalogue read returns all 8.
- **Web config:** Firebase Web App created → `samadhan/.env.local` (`NEXT_PUBLIC_FIREBASE_*`, gitignored). Officer/admin demo creds → `samadhan/scripts/seed-output.local.json` (gitignored).
- **Repo:** github.com/chinmoypaul8897/samadhan — git root = project folder; app in `/samadhan`. C1 = 5 code commits + 1 C1b tooling commit, pushed.
- **Toolchain:** node v24, git, Docker ✓ · `gcloud` at `C:\Users\chinm\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin` (prepend PATH; run via PowerShell). **firebase CLI NOT installed** — C1b cloud bring-up was done entirely via **gcloud + ADC + Firebase REST APIs** (no `firebase login` needed). ADC configured → seed + Admin run locally. REST calls need an `x-goog-user-project` header (ADC quota project).
- **Dev-server port:** **3000 busy → always use a non-3000 port (e.g. 3030).**
- **Playwright MCP:** server **connects (√)** but its tools are **NOT loaded in this session** (they register at session start) → **restart the session** to get browser tools, then screenshot the signed-in shell + category grid. C1 was verified headlessly instead (deny-test + anonymous catalogue read).
- **Deferred to C2** (neither blocks the C1 gate): (1) Storage default bucket + `storage.rules` deploy — first used by capture upload; (2) live Cloud Run redeploy with `NEXT_PUBLIC_*` inlined — Dockerfile build-args are staged, needs a Cloud Build build-arg pass.

---

## Log

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

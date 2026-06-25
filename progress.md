# progress.md — Running Log (reality)

> Newest first. The **Current State** block is the 5-second catch-up for the next chunk. Plans live in the spec files; this is what *actually* happened (incl. every deviation).

## Current State
- **Phase:** Foundation · **Chunk:** **C0 COMPLETE ✅** (gate green — deployed + verified live). **Next: C1.**
- **Live:** https://samadhan-554128679437.asia-south1.run.app · project `samadhan-civic-7k4m2` · region asia-south1.
- **Planning foundation complete:** CLAUDE.md, what-to-build.md, data-shapes.md, DESIGN.md, backend-plan.md, frontend-plan.md.
- **Repo:** github.com/chinmoypaul8897/samadhan — git root = project folder; the app lives in `/samadhan`.
- **Toolchain here:** node v24.14, npm 10.8, git 2.43, Docker 29.4 ✓ · `gh`/`gcloud`/`firebase` NOT installed → **C0b cloud bring-up is a runbook for the user** (`docs/runbook-c0b.md`).
- **MCP:** Playwright MCP added (chromium, local scope) for live browser verification — **activates only after a session restart** (MCP loads at session start). Firebase MCP deferred to C1 (needs `firebase login`).
- **Dev-server port:** **3000 is busy on this machine — always use a non-3000 port (e.g. 3030).**
- **C0b cannot be automated by me:** it's gated on the user's Google OAuth + billing + Gemini key (identity/payment boundary, not tooling). Path: Google Cloud Shell (preinstalled+authed) per runbook, or user runs `gcloud auth login` once and I run the rest.
- **Next:** **C1** (auth + Firestore rules + indexes + Bengaluru seed). Also: restart session so Playwright MCP tools load → screenshot the live app.

---

## Log

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

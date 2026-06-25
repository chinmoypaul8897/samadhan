# progress.md — Running Log (reality)

> Newest first. The **Current State** block is the 5-second catch-up for the next chunk. Plans live in the spec files; this is what *actually* happened (incl. every deviation).

## Current State
- **Phase:** Foundation · **Chunk:** C0 — **C0a complete (local, built + verified)**; **C0b pending** (cloud bring-up → `docs/runbook-c0b.md`).
- **Planning foundation complete:** CLAUDE.md, what-to-build.md, data-shapes.md, DESIGN.md, backend-plan.md, frontend-plan.md.
- **Repo:** github.com/chinmoypaul8897/samadhan — git root = project folder; the app lives in `/samadhan`.
- **Toolchain here:** node v24.14, npm 10.8, git 2.43, Docker 29.4 ✓ · `gh`/`gcloud`/`firebase` NOT installed → **C0b cloud bring-up is a runbook for the user** (`docs/runbook-c0b.md`).
- **MCP:** Playwright MCP added (chromium, local scope) for live browser verification — **activates only after a session restart** (MCP loads at session start). Firebase MCP deferred to C1 (needs `firebase login`).
- **Dev-server port:** **3000 is busy on this machine — always use a non-3000 port (e.g. 3030).**
- **C0b cannot be automated by me:** it's gated on the user's Google OAuth + billing + Gemini key (identity/payment boundary, not tooling). Path: Google Cloud Shell (preinstalled+authed) per runbook, or user runs `gcloud auth login` once and I run the rest.
- **Next:** **user runs `docs/runbook-c0b.md`** (gcloud/firebase — not installed here) → live Cloud Run URL + `/api/health` `adminReady:true` + budget alert + confirm repo is Public. Then start **C1** (auth + rules + indexes + seed).

---

## Log

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

# progress.md — Running Log (reality)

> Newest first. The **Current State** block is the 5-second catch-up for the next chunk. Plans live in the spec files; this is what *actually* happened (incl. every deviation).

## Current State
- **Phase:** Foundation · **Chunk:** C0 (in progress — C0a local build).
- **Planning foundation complete:** CLAUDE.md, what-to-build.md, data-shapes.md, DESIGN.md, backend-plan.md, frontend-plan.md.
- **Repo:** github.com/chinmoypaul8897/samadhan — git root = project folder; the app lives in `/samadhan`.
- **Toolchain here:** node v24.14, npm 10.8, git 2.43, Docker 29.4 ✓ · `gh`/`gcloud`/`firebase` NOT installed → **C0b cloud bring-up is a runbook for the user** (`docs/runbook-c0b.md`).
- **Next:** finish C0a (Next PWA scaffold → tokens/fonts → Button → landing → manifest/sw → firebase-admin/client → /api/health → Dockerfile; verify `npm run build` + local server + Docker), then C0b (user runs gcloud/firebase to reach the full C0 gate: live Cloud Run URL + adminReady:true + budget alert).

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

# backend-plan.md — Backend Build Spec (chunk by chunk)

> The backend half of every chunk. Build **one chunk at a time, in order**; stop at each "Done when" gate. Structures come from `data-shapes.md` (never redefined here). Product intent: `what-to-build.md`. Rules: `CLAUDE.md`. Frontend half of each chunk: `frontend-plan.md` (shared chunk numbers).
> Every external contract below is bound to an official doc verified 2026. **Never guess an endpoint/field — take it from §A or the chunk's "Bindings".**

---

## §A. Global contracts (bind once, reference everywhere)

### A.1 Stack + package versions
```
next (App Router, TypeScript) + tailwindcss
firebase            (client SDK)          firebase-admin (server, ADC)
genkit@1.38.x       @genkit-ai/google-genai@1.38.x   ← NOT the deprecated @genkit-ai/googleai
@genkit-ai/next     (appRoute + /client)  @genkit-ai/firebase (telemetry)   genkit-cli (dev UI)
geofire-common      google-auth-library   (OIDC verify for the SLA sweep)
```
Node base image: `node:22-slim`. Region: `asia-south1` (Mumbai) for Cloud Run + Scheduler.

### A.2 Genkit + Gemini (the agent engine)
```ts
// src/genkit/index.ts   — server-only
import 'server-only';
import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
export const ai = genkit({ plugins: [googleAI()] });
export const MODEL = googleAI.model('gemini-2.5-flash');
export { z };
```
- **Structured call:** `const { output } = await ai.generate({ model: MODEL, prompt, output: { schema } });` → `output` is `z.infer<schema> | null`. **Schema-mismatch retry is MANUAL** → always wrap in `withRetry` (A.6).
- **Image part:** `{ media: { url: 'data:image/jpeg;base64,<b64>' } }`. Multi-image = array of media parts + a text part (used by Dedup C5 and Verify C9).
- **Flow:** `ai.defineFlow({ name, inputSchema, outputSchema }, async (input) => {...})`. **Traced sub-step:** `await ai.run('perceive', async () => {...})` — each becomes a span in the Dev UI (the demo + Agentic-Depth evidence).
- **Expose to Next:** `export const POST = appRoute(intakeFlow)` from `@genkit-ai/next` in a route handler; client calls `runFlow({ url, input })` from `@genkit-ai/next/client`.
- **Key:** env `GEMINI_API_KEY` (server-only, Secret Manager). **Dev UI:** `genkit start -- npm run dev` → http://localhost:4000.
- **Prod telemetry:** `enableFirebaseTelemetry()` (@genkit-ai/firebase) in `src/genkit/index.ts`.
- Docs: genkit.dev/docs/models, /flows, /tool-calling, /nextjs, /devtools; ai.google.dev/gemini-api/docs/image-understanding, /structured-output.

### A.3 Firebase Admin (server) — ADC, no key file
```ts
// src/lib/firebase-admin.ts — server-only
import 'server-only';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getMessaging } from 'firebase-admin/messaging';
const app = getApps().length ? getApps()[0]
  : initializeApp({ storageBucket: `${process.env.GCLOUD_PROJECT}.firebasestorage.app` });
export const db = getFirestore();
export const bucket = getStorage().bucket();
export const messaging = getMessaging();
export { FieldValue };
```
- Cloud Run service account IAM: `roles/datastore.user` + `roles/storage.objectAdmin` + `roles/firebasecloudmessaging.admin` + `roles/secretmanager.secretAccessor`.
- **Admin bypasses security rules** → all derived writes go through Admin (server). Clients write only what rules explicitly allow (A.5).
- Writes: `FieldValue.serverTimestamp()`, `FieldValue.increment(n)`, `db.runTransaction(async t => { /* reads BEFORE writes */ })`, `db.batch()`.
- Docs: firebase.google.com/docs/admin/setup, /firestore/manage-data/transactions.

### A.4 Firebase client (browser) — public config
```ts
// src/lib/firebase-client.ts
import { initializeApp, getApps } from 'firebase/app';
// config from NEXT_PUBLIC_FIREBASE_* (not secret by design)
```
Used for: anonymous Auth, Storage upload, Firestore `onSnapshot` (live report-pipeline + issue timeline), FCM `getToken`.

### A.5 Env / secrets split
| Value | Mechanism | Side |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_MAPS_BROWSER_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | inlined at `next build` (Docker builder stage) | client |
| `GEMINI_API_KEY`, `MAPS_SERVER_KEY`, `VAPID_PRIVATE_KEY`, `SCHEDULER_SA_EMAIL` | Cloud Run `--set-secrets` (Secret Manager) | server only |
| Firebase Admin creds | ADC (none) | server |

Two Maps keys: **browser key** (HTTP-referrer + Maps-JS-API restricted) and **server key** (IP + Geocoding-API restricted). Gemini key NEVER `NEXT_PUBLIC_`. Docs: cloud.google.com/run/docs/configuring/services/secrets; developers.google.com/maps/api-security-best-practices.

### A.6 Shared server utilities (`src/lib/`)
- `withRetry(fn, {tries:3, baseMs:500})` — exp backoff on null-output / `RESOURCE_EXHAUSTED` / `UNAVAILABLE`. Wraps every `ai.generate`.
- `trackingId()` → `"SMD-" + base32(crypto.randomBytes(5))` (8 Crockford chars, no date).
- `geo.ts` — re-exports `geohashForLocation([lat,lng])` (10-char), `geohashQueryBounds([lat,lng], radiusM)`, `distanceBetween(a,b)` **× 1000 → metres** (km→m gotcha).
- `sla.ts` — `computeSlaState(issue, now)`: `met` if resolved ≤ deadline; else `breached` if now>deadline; `due_soon` if remaining < 25% of slaHours; else `on_track`.
- `status.ts` — `transition(issueRef, from, to, {actor, note})`: validates against the state machine (data-shapes §9), writes `status`+`statusNotes`+`updatedAt`, appends `activity`, fires FCM (C7).
- `claims.ts` — `requireOfficer(req)`/`requireAdmin(req)`: verify Firebase ID token + custom claim; `assertJurisdiction(officer, issue)`.
- `gemini-judge` guardrail: AI verdicts are advisory; never auto-finalise `verified_resolved` (data-shapes §8.6).

### A.7 API surface (all server-side; Admin SDK unless noted)
| Route | Method | Auth | Chunk | Purpose |
|---|---|---|---|---|
| `/api/health` | GET | public | C0 | liveness + Admin init check |
| `/api/intake` | POST | citizen | C3–C6 | the Genkit pipeline flow (`appRoute`) |
| `/api/fcm/register` | POST | citizen | C7 | store FCM token on `users` |
| `/api/issues/[id]/file` | POST | citizen (owner) | C6 | one-tap consent → `filing.status=submitted` |
| `/api/issues/[id]/verify-confirm` | POST | citizen (owner) | C9 | citizen confirms/denies fix |
| `/api/issues/[id]/escalations/[eid]/send` | POST | citizen (owner) | C10 | one-tap send escalation |
| `/api/issues/[id]/confirm` | POST | citizen | C13 | "me too" |
| `/api/officer/queue` | GET | officer | C8 | queue sorted by supporterCount |
| `/api/officer/issues/[id]/action` | POST | officer | C8 | acknowledge/assign/start/resolve/cannot_fix |
| `/api/internal/sla-sweep` | POST | OIDC (Scheduler) | C10 | SLA flip + escalate + auto-confirm |
| `/api/stats` | GET | public | C11 | honest metrics |
| `/api/issues/geo` | GET | public | C11 | heatmap/cluster points |
| `/api/open311/requests` | GET | public | C14 | Open311 export |

### A.8 Module map
```
src/
  app/api/.../route.ts        endpoints above
  app/manifest.ts             PWA manifest
  genkit/index.ts             ai init (server-only)
  genkit/schemas.ts           zod mirrors of data-shapes §8
  genkit/flows/intake.ts      the pipeline flow
  genkit/steps/{perceive,locate,dedup,route,act,verify,escalate}.ts
  lib/firebase-admin.ts  firebase-client.ts  geo.ts  sla.ts  status.ts  claims.ts  retry.ts  trackingId.ts
public/ sw.js  firebase-messaging-sw.js  icon-192.png  icon-512.png
firestore.rules  firestore.indexes.json  storage.rules  Dockerfile  next.config.ts
```

---

## Chunk index

| # | Phase | Backend deliverable | Agent step | Depends |
|---|---|---|---|---|
| C0 | Foundation | Repo, Next PWA scaffold, Firebase/GCP wiring, **hello deployed to Cloud Run**, budget alert | — | — |
| C1 | Foundation | Auth + Firestore/Storage/rules + indexes + **seed** catalogue/authorities/officers | — | C0 |
| C2 | Core | Capture → Storage upload → create `report` (client write, validated) | Capture | C1 |
| C3 | Core | Genkit `intakeFlow` + **Perceive** + live trace | Perceive | C2 |
| C4 | Core | **Locate** + create seed `issue` + start SLA | Locate | C3 |
| C5 | Core | **Dedup** → merge & amplify (transaction) | Dedup | C4 |
| C6 | Core | **Route + Act** (authority + drafted complaint + one-tap file) | Route, Act | C5 |
| C7 | Depth | Track: status machine + FCM + timeline | Track | C6 |
| C8 | Depth | Officer portal API (queue + actions + proof-of-fix) | — | C7 |
| C9 | Depth | **Verify** before/after + citizen confirm | Verify | C8 |
| C10 | Depth | **Escalate**: Scheduler sweep → drafts + one-tap send | Escalate | C7,C9 |
| C11 | Polish | Public stats + heatmap geo API | Learn | C7 |
| C12 | Polish | Hardening: validation, errors, rate-limit | — | all |
| C13 | Polish [T2] | Voice/translate, WhatsApp, me-too, phone-OTP, moderation | — | C6 |
| C14 | Polish | Open311 export + final deploy + artifacts | — | all |

---

## C0 — Foundation: scaffold + deploy a hello page to Cloud Run  [Phase: Foundation]

**Purpose:** prove the whole deploy pipeline on day one (de-risks the submission gate) and lay the project skeleton. Nothing AI yet.

**Bindings:** Cloud Run container contract (`docs.cloud.google.com/run/docs/container-contract`); Next standalone (`nextjs.org/docs/app/api-reference/config/next-config-js/output`); `gcloud run deploy` (`docs.cloud.google.com/sdk/gcloud/reference/run/deploy`); Firebase Admin setup.

**Build sections**
1. **Repo:** `git init`; create **public** GitHub repo; first commit. Conventional Commits + co-author per CLAUDE.md §6.
2. **App:** scaffold Next.js (App Router, TS) + Tailwind. `next.config.ts`: `output:'standalone'`, `serverExternalPackages:['firebase-admin','genkit','@genkit-ai/google-genai']`, SW + `Permissions-Policy: camera=(self), geolocation=(self)` headers.
3. **Dockerfile** (multi-stage `node:22-slim`, standalone): copy `public` + `.next/standalone` + `.next/static`; non-root `nextjs` user; `ENV HOSTNAME=0.0.0.0 PORT=8080`; `CMD ["node","server.js"]`. App reads `process.env.PORT` (Cloud Run injects it — **PORT is reserved, do not override**).
4. **GCP project:** enable APIs — Firestore, Storage, Maps JavaScript, Geocoding, FCM, Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud Scheduler, Generative Language (Gemini). Create the runtime **service account** + grant A.3 roles.
5. **Firebase:** attach to same project; create Firestore (native, asia-south1), Storage bucket, enable Auth.
6. **Secrets/env:** put `GEMINI_API_KEY` (from AI Studio) in Secret Manager; set `NEXT_PUBLIC_*` for build.
7. **Admin + health:** `src/lib/firebase-admin.ts` (A.3); `GET /api/health` → `{ ok:true, projectId, adminReady:true }`.
8. **Deploy:** `gcloud run deploy samadhan --source . --region asia-south1 --allow-unauthenticated --service-account <SA> --set-secrets GEMINI_API_KEY=...:latest`. (Dockerfile present ⇒ buildpacks bypassed.)
9. **Budget alert:** Cloud Billing budget (e.g. small cap) with email at 50/90/100%.

**Error/edge:** if standalone server 404s static, confirm `.next/static` + `public` copied. If Admin init fails, the SA lacks roles or `GCLOUD_PROJECT` unset.

**Done when:** public HTTPS Cloud Run URL serves the app; `/api/health` returns `ok:true` with the real `projectId` and `adminReady:true`; repo is public; budget alert active.

**Demo checkpoint:** "the app is live on Google Cloud" (a real URL) — submission gate de-risked.

---

## C1 — Auth + rules + indexes + seed data  [Phase: Foundation]

**Purpose:** identity, the security perimeter, and the reference data the agent routes against.

**Bindings:** Firebase Anonymous Auth + custom claims (`firebase.google.com/docs/auth/admin/custom-claims`); Firestore rules (`/docs/firestore/security/*`); indexes (`/docs/reference/firestore/indexes`); Storage rules (`/docs/storage/security`).

**Build sections**
1. **Anonymous auth:** client signs in anonymously on first load; on sign-in, client creates `users/{uid}` with `role:'citizen'`, `isAnonymous:true`, `languagePref:'en'`, `fcmTokens:[]`. (Phone-OTP upgrade is C13.)
2. **`firestore.rules`** (deploy): per data-shapes §12. Key gates:
   - `users/{uid}`: read self+staff; create/update self **only with `role=='citizen'`** (officer/admin role set via custom claims, not client).
   - `serviceCatalog`,`authorities`: public read; write `false`.
   - `reports/{id}`: read owner+staff; **create** if `signed-in && reporterUid==auth.uid && status=='processing'` and `!hasAny(['analysis','dedup','issueId'])`; **update/delete `false`** (server-only).
   - `issues/{id}`: read if `isPublic==true` (owner/officer for private via claim); **write `false`** (server-only).
   - `issues/{id}/{activity,escalations}`: read per parent; write `false`. `confirmations/{uid}`: create if own uid (C13).
3. **`firestore.indexes.json`** (deploy): the composites from data-shapes §10 — incl. `issues (serviceCode ASC, geohash ASC)` for dedup, `issues (routing.authorityId ASC, status ASC, supporterCount DESC)` for the officer queue, `issues (status ASC, sla.deadline ASC)` for the sweep.
4. **`storage.rules`** (deploy): `match /reports/{uid}/{p=**}` allow write if `auth.uid==uid && size<5MB && contentType.matches('image/.*')`; reads gated.
5. **Custom claims script** (Admin): `setCustomUserClaims(uid,{role:'officer',authorityId,jurisdictionWards})` for seeded officers; `{role:'admin'}` for you.
6. **Seed script** (Admin, idempotent):
   - `serviceCatalog` (8 docs) with real SLAs + sources: `pothole`/24h, `streetlight`/24h (GHMC charter), `garbage_dump`/12h, `sewer_overflow`/12h, `dead_animal`/48h, `stagnant_water`/48h (Swachhata/GHMC), `water_leak`/24h (water-board norm — *approx*), `power_outage`/24h (DISCOM norm — *approx*). Each: `group`, `keywords`, `defaultAuthorityType`, `defaultDepartment`, `hazardDefault`, `slaSource`.
   - `authorities` (Bengaluru): `bbmp` (municipal_corporation), `bwssb` (water_board), `bescom` (discom) — `channels`, `charterSlas`, `escalationContacts` (L1 Asst. Engineer → L2 Zonal/Executive → L3 Commissioner/Chairman), `isSimulated:true`.
   - 2–3 officer `users` (one per authority) + claims.

**Error/edge:** rules deploy fails → run `firebase emulators:exec` to lint first. Seed re-run must upsert (use `set` with deterministic IDs).

**Done when:** anonymous sign-in creates a `citizen` user doc; a client attempt to write `issues` or set `role:'officer'` is **denied**; indexes are live; `serviceCatalog`(8) + `authorities`(3) + officer users are seeded and publicly readable.

**Demo checkpoint:** app loads signed-in; category list + authorities visible from real data.

---

## C2 — Capture → upload → create report  [Phase: Core]

**Purpose:** the frictionless on-ramp; produce a `report` the pipeline can run on. (UI in frontend-plan.)

**Bindings:** Storage Web upload (`firebase.google.com/docs/storage/web/upload-files`); Geolocation/secure-context (MDN); geofire-common.

**Build sections** (backend/server contracts; capture UI is frontend)
1. **Media upload (client):** `ref(storage,'reports/{uid}/{reportId}/original.jpg')` → `uploadBytes(ref,file,{contentType})` → `getDownloadURL`. `reportId` = client-generated id (so it can subscribe immediately). Optional `voice.webm` likewise.
2. **Location (client):** `navigator.geolocation.getCurrentPosition` → `location{lat,lng}`, `accuracyM`; compute `geohash = geohashForLocation([lat,lng])`.
3. **Create report (client write, rules-validated):** doc `reports/{reportId}` = `{ reporterUid, channel:'app', status:'processing', media{path,downloadUrl,contentType,sizeBytes,exifGps?}, voiceNote?, location, geohash, accuracyM, rawText?, isSeed:false, pipeline:[5 steps =pending], createdAt:serverTimestamp }`. Steps seeded: perceive, locate, dedup, route, act (status `pending`).
4. **Subscribe (client):** `onSnapshot(reports/{reportId})` to render the live agent trace (drives C3+ UI).
5. **Kick the pipeline:** `runFlow({ url:'/api/intake', input:{ reportId } })` (the flow is built C3–C6; in C2 it can be a stub that returns `{accepted:true}`).

**Error/edge:** geolocation denied → allow manual map-pin (frontend) but still require a `location`. Upload failure → retry; never create the report without media. EXIF GPS advisory only (data-shapes §7).

**Done when:** a signed-in user captures a photo → it lands in Storage at the spec path → a `reports/{id}` doc exists with correct fields + valid 10-char geohash + 5 pending pipeline steps; ownership enforced by rules; the doc is visible via `onSnapshot`.

**Demo checkpoint:** snap a photo → it appears under "My Reports" as *Processing*.

---

## C3 — Perceive (Genkit + Gemini vision) + live trace  [Phase: Core]

**Purpose:** the agentic anchor — one structured Gemini call turns a photo into a classified report; the trace renders live.

**Bindings:** A.2; ai.google.dev/gemini-api/docs/image-understanding, /structured-output.

**Build sections**
1. **Schemas** (`genkit/schemas.ts`): zod `PerceiveOutput` exactly per data-shapes §8.1 (`isCivicIssue, confidence, serviceCode, serviceName, subCategory?, severity, hazard, caption, ocrText|null, suggestedTitle, tags, languageDetected, reasoning`).
2. **Flow skeleton** (`genkit/flows/intake.ts`): `ai.defineFlow({name:'intakeFlow', inputSchema:z.object({reportId:z.string()}), outputSchema:...}, async ({reportId}) => {...})`; load report (Admin); guard ownership via the flow's auth context.
3. **Perceive step** (`genkit/steps/perceive.ts`, run via `ai.run('perceive', …)`):
   - Load image bytes (Admin `bucket.file(path).download()`) → base64 data URL.
   - Load valid `serviceCode`s from `serviceCatalog` (cache).
   - `withRetry(() => ai.generate({ model:MODEL, prompt:[{media:{url}}, {text: PERCEIVE_PROMPT}], output:{schema:PerceiveOutput} }))`.
   - **Prompt** enumerates the catalogue codes, defines severity bands (low/med/high) + hazard rule, demands `isCivicIssue` gate, OCR of signs/landmarks, language detection, short reasoning. Constrain `serviceCode` to the catalogue; if none fit → `serviceCode:'other'`.
4. **Validate + persist:** if `!isCivicIssue || confidence < 0.5` → `report.status='rejected'` (or `needs_review`), stop pipeline, notify "couldn't recognise a civic issue, try again." Else write `report.analysis`, set `pipeline[perceive]=done` with `summary` + `latencyMs`. Live trace updates via the client's `onSnapshot`.
5. **Expose:** `export const POST = appRoute(intakeFlow)` at `/api/intake`.

**Error/edge:** `output===null` after retries → `pipeline[perceive]=error`, `report.status='needs_review'` (never silently drop). Rate-limit (`RESOURCE_EXHAUSTED`) → backoff then graceful "high demand, queued" state. Oversized image → downscale before send (≤ ~1024px).

**Done when:** posting a real civic photo to `/api/intake` returns valid `PerceiveOutput`; `report.analysis` populated; trace shows *perceive: done* with latency; a non-civic photo is `rejected`; the Genkit Dev UI shows the perceive span.

**Demo checkpoint:** snap → watch the agent classify the issue live (category + severity + caption).

---

## C4 — Locate + create seed issue + start SLA  [Phase: Core]

**Purpose:** turn the classified report into a tracked, deadlined `issue`. This completes the first end-to-end vertical slice.

**Bindings:** Maps reverse geocoding `GET https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={MAPS_SERVER_KEY}` (server-side); data-shapes §6.

**Build sections**
1. **Locate step** (`steps/locate.ts`): server fetch reverse-geocode → scan `results[0].address_components[]`: `addressString=formatted_address`, `zipcode=postal_code`, `city=locality`, **`ward≈sublocality_level_1`** (fallback `neighborhood`/`sublocality_level_2`; *approx — Geocoding has no civic-ward field*), `zone=administrative_area_level_2/3`. Persist into the issue (below). `pipeline[locate]=done`.
2. **Issue assembly** (seed path; dedup added C5 — here every report seeds): build `issues/{id}` per data-shapes §6 from `report.analysis` + locate:
   - `trackingId=trackingId()`, `status:'submitted'`, `statusNotes:''`, `severity/hazard/serviceCode/serviceName/group/subCategory` from analysis, `title=suggestedTitle`, `description=caption (+rawText)`, `location`, `geohash` (server recompute), `addressString/ward/zone/city/zipcode`, `beforeMedia=report.media`, `mediaPaths:[path]`, `reportCount:1`, `supporterCount:1`, `tags`, `isPublic:true`, `reporterUid`.
   - **SLA:** `slaHours = authority.charterSlas[serviceCode] ?? serviceCatalog.slaHours`; `sla={slaHours, startedAt:now, deadline: now+slaHours, state:'on_track'}`.
   - `routing`/`filing`/`verification` left minimal placeholders until C6/C9 (`routing:null`-ish, `filing:{status:'draft'}`, `verification:{required:true, beforeMediaPath}`). `escalationLevel:0`.
3. **Link report:** `report.issueId=id`, `isSeed:true`, `status:'seeded'`; copy `before.jpg` to `issues/{id}/before.jpg` (or reuse report path). Write `activity:{type:'system', message:'Issue created'}`.

**Error/edge:** geocode `ZERO_RESULTS`/`OVER_QUERY_LIMIT` → store coords + `addressString:'(approx)'`, continue (location must never block creation). Keep Geocoding under the 10k/mo free cap.

**Done when:** a processed report yields an `issue` with `trackingId`, resolved address+ward, a live SLA `deadline`, `beforeMedia`, `status:'submitted'`; the report is linked (`issueId`,`isSeed:true`,`status:'seeded'`); activity logged.

**Demo checkpoint (Slice #1):** snap → AI classifies → a tracked issue appears with a **live SLA countdown**.

---

## C5 — Dedup → merge & amplify  [Phase: Core]

**Purpose:** the first standout — turn the 51st report into "N citizens reported this," never a duplicate, never a silent close.

**Bindings:** geofire-common + Firestore geoqueries (`/docs/firestore/solutions/geoqueries`); transactions; A.2 multi-image.

**Build sections**
1. **Candidate query** (`steps/dedup.ts`, before seeding): `bounds = geohashQueryBounds([lat,lng], 50)`; for each `[s,e]` query `issues.orderBy('geohash').startAt(s).endAt(e)` **+ equality `serviceCode==`** (composite index from C1) **+** active status filter; merge; **distance-filter `distanceBetween(...)*1000 ≤ 50`** (km→m gotcha).
2. **AI confirm:** if candidates, take nearest 1–3; `withRetry(ai.generate({ prompt:[{media:reportPhoto},{media:candidate.beforeMedia},{text: SAME_ISSUE_PROMPT}], output:{schema:DedupVerdict} }))` (data-shapes §8.2: `{sameIssue,confidence,reasoning}`).
3. **Apply (transaction — reads before writes):** if `sameIssue && confidence≥0.6`: re-read candidate (still active?), `t.update(issue,{ supporterCount:increment(1), reportCount:increment(1), mediaPaths:arrayUnion(path), updatedAt:serverTimestamp })`; `t.update(report,{issueId, isSeed:false})`; add `activity{type:'new_supporter', message:'Another citizen reported this'}`. Else → seed (C4). Set `report.dedup` + `report.status` (`linked`|`seeded`). `pipeline[dedup]=done`.
4. **Inherit on link:** linked reports **skip** route/act (mark those steps `skipped`) — they inherit the issue's routing/filing (matches the data-shapes example).

**Error/edge:** Gemini compare fails → fall back to geo+category match at tighter radius (≤20 m) to avoid false merges; if uncertain, **seed new** (a false duplicate is worse than a second issue). Never delete/close on dedup.

**Done when:** a second report within 50 m of an active same-category issue **links** and increments `supporterCount` (no new issue); a distant/different report **seeds** a new issue; counts are correct; nothing is deleted or closed.

**Demo checkpoint (Standout #1):** report a pothole already reported → *"14 citizens already reported this — your photo adds weight."*

---

## C6 — Route + Act  [Phase: Core]

**Purpose:** the second standout — route to the *correct* body and draft the formal complaint; one-tap to file.

**Bindings:** A.2 structured output; `authorities` seed; data-shapes §8.3/§8.4.

**Build sections**
1. **Route step** (`steps/route.ts`, seed path only): rules-first — `authorityType = serviceCatalog.defaultAuthorityType`; pick the `authority` in `city` of that `type` whose `jurisdictionWards` covers `ward` (else city default). Gemini only to disambiguate edge cases → `Routing{authorityType,authorityId,department,channel,confidence,reasoning}`. Persist `issue.routing` + `agencyResponsible=authority.name`.
2. **Act step** (`steps/act.ts`): `withRetry(ai.generate({ prompt: ACT_PROMPT(issue, authority, lang), output:{schema:Filing} }))` → formal `complaintText` in `languageDetected` (English/Hindi), `format` from `authority.channels` (`municipal_portal`|`email`|`cpgrams`), `status:'prepared'`, `externalRef:null`. Persist `issue.filing`.
3. **One-tap file** (`POST /api/issues/[id]/file`, owner): validate owner; set `filing.status='submitted'`, `filing.submittedAt`, `filing.consentByUid`; `activity{type:'system',message:'Complaint filed to '+agencyResponsible}`. (Submission is simulated to the officer portal — honest human-in-loop gate; no fake gov API.)

**Error/edge:** no authority matches ward → route to city-level default + flag low `confidence`. Act returns null → `filing.status='draft'` + retry; never auto-submit without the citizen tap.

**Done when:** pothole→`bbmp`, water_leak→`bwssb`, power_outage→`bescom`; `issue.filing` holds a sensible drafted complaint in the right language/format; one-tap `file` flips to `submitted` and logs activity.

**Demo checkpoint (Standout #2):** *"I've drafted the complaint to BBMP Roads and started the 24-hour SLA clock — tap to file."*

---

## C7 — Track: status machine + FCM + timeline  [Phase: Depth]

**Purpose:** the loop's spine — honest status, push on every change, a visible timeline (the +57% retention lever).

**Bindings:** FCM Admin send (`/docs/cloud-messaging/send/admin-sdk`) + web client `getToken` (`/docs/cloud-messaging/js/client`).

**Build sections**
1. **Status helper** (`lib/status.ts`): `transition()` enforces data-shapes §9 transitions; rejects illegal moves; writes `status/statusNotes/updatedAt` + `activity{type:'status_change',fromStatus,toStatus}` + triggers notify.
2. **FCM register** (`POST /api/fcm/register`): client `getToken(messaging,{vapidKey:NEXT_PUBLIC_VAPID_PUBLIC_KEY})` (needs `public/firebase-messaging-sw.js`) → store in `users.fcmTokens` (arrayUnion). Prune dead tokens on send failure.
3. **Notify** (`lib/notify.ts`): `messaging.sendEachForMulticast({tokens, notification{title,body}, data{issueId,trackingId,toStatus}})`; called by `transition()` and by `new_supporter`/escalation/verification events. (`data` values must be strings.)
4. **SLA state on read + display:** `computeSlaState` used by `/api/issues` responses and the sweep (C10). Timeline = the `activity` subcollection (already populated) rendered chronologically (frontend).

**Error/edge:** unsupported browser (`isSupported()` false) → skip push, keep in-app timeline. Multicast partial failure → remove invalid tokens.

**Done when:** any status change writes an `activity` entry and pushes to the reporter's devices; the citizen sees a live timeline; `slaState` shows on_track/due_soon/breached correctly.

**Demo checkpoint:** change a status → phone gets a push + the timeline updates.

---

## C8 — Authority / Officer portal (backend)  [Phase: Depth]

**Purpose:** the simulated municipal side that makes the loop real and surfaces the support count to staff (the mechanism that drives resolution).

**Bindings:** custom claims (C1); FCM (C7); Storage after-media; data-shapes §6/§12.

**Build sections**
1. **Queue** (`GET /api/officer/queue`): `requireOfficer`; query `issues` where `routing.authorityId == officer.authorityId` and `status` active, `orderBy supporterCount desc` (composite index C1); optional ward filter. Return list + counts.
2. **Action** (`POST /api/officer/issues/[id]/action {action,note,afterMediaPath?}`): `requireOfficer` + `assertJurisdiction`. Map action → transition: `acknowledge`(submitted→acknowledged), `assign`(→assigned, set `assignedOfficerUid`), `start`(→in_progress), `resolve`(→resolved_pending_verification, **require `afterMediaPath`**, set `verification.afterMediaPath`, `resolvedAt`), `cannot_fix`(→cannot_fix, require `note`). Each via `transition()` (logs + notifies citizen).
3. **After media:** officer uploads to `issues/{id}/after/{uid}.jpg` (Storage rule for officer path) → path passed to the action.

**Error/edge:** officer acting outside `jurisdictionWards`/`authorityId` → 403. `resolve` without after photo → 400 (proof-of-fix mandatory — anti-pattern guard).

**Done when:** an officer signs in, sees their authority's queue sorted by support, and can drive an issue acknowledge→in_progress→resolved (with proof photo); every step notifies the citizen and logs activity.

**Demo checkpoint:** officer resolves an issue with a photo → citizen is notified "marked resolved — please confirm."

---

## C9 — Verify (the differentiator)  [Phase: Depth]

**Purpose:** the third standout — independently verify the fix; "resolved" is real only when the citizen confirms.

**Bindings:** A.2 multi-image; data-shapes §8.6 (AI advisory, never auto-finalise).

**Build sections**
1. **Verify step** (`steps/verify.ts`, on `resolve`): `withRetry(ai.generate({ prompt:[{media:beforeMedia},{media:afterMedia},{text: VERIFY_PROMPT}], output:{schema: aiVerdict} }))` → `{resolved,confidence,reasoning,gpsMatch,timestampMatch}`. `gpsMatch` = after-media exif/officer-location within ~50 m of `issue.location`; `timestampMatch` = after `capturedAt` > before. Write `issue.verification.aiVerdict`.
2. **Citizen prompt:** notify "Does this look fixed?" with before/after.
3. **Confirm** (`POST /api/issues/[id]/verify-confirm {confirmed}`, owner): if `confirmed` → `verification.citizenConfirmed=true, outcome:'verified', finalizedAt`; `transition(resolved_pending_verification→verified_resolved)`, set `verifiedAt`. If `!confirmed` → `outcome:'rejected'`, `transition(→reopened→in_progress)`, optionally trigger escalation (C10), notify officer.
4. **Guard:** `verified_resolved` only when `citizenConfirmed===true` **or** sweep `outcome:'auto'`. AI verdict alone never finalises.

**Error/edge:** missing after photo → `verification.required` stays, block resolve. AI verdict low confidence or `gpsMatch:false` → surface "photo may not match location" + recommend reopen/escalate (the demo line).

**Done when:** officer resolve runs an AI before/after verdict (visible, with reasoning + gps/timestamp checks); citizen confirm → `verified_resolved`; citizen deny or mismatch → `reopened`; AI never auto-closes.

**Demo checkpoint (Standout #3):** mismatched "after" photo → *"the resolved photo doesn't match this location — reopening."*

---

## C10 — Escalate: Scheduler sweep → drafts → one-tap send  [Phase: Depth]

**Purpose:** autonomous escalation on SLA breach — the gap nobody fills, autonomy made visible.

**Bindings:** Cloud Scheduler→Run OIDC (`cloud.google.com/run/docs/triggering/using-scheduler`); `google-auth-library` token verify; A.2.

**Build sections**
1. **Scheduler job:** `gcloud scheduler jobs create http sla-sweep --location asia-south1 --schedule "*/10 * * * *" --time-zone "Asia/Kolkata" --uri <SERVICE_URL>/api/internal/sla-sweep --http-method POST --oidc-service-account-email <SCHEDULER_SA> --oidc-token-audience <SERVICE_URL>`; grant that SA `roles/run.invoker`.
2. **Endpoint auth:** service is public (citizens use it), so `/api/internal/sla-sweep` must itself verify the `Authorization: Bearer` OIDC token (`OAuth2Client.verifyIdToken({idToken, audience:SERVICE_URL})` and `payload.email===SCHEDULER_SA_EMAIL`); else 401.
3. **Sweep logic:**
   - **SLA:** query `issues` active where `sla.deadline < now`; set `sla.state='breached'` (+`due_soon` updates); for each breached not yet escalated at this level → escalate.
   - **Auto-verify:** query `resolved_pending_verification` older than the grace window → `verification.outcome='auto'`, `transition(→verified_resolved)`.
4. **Escalate step** (`steps/escalate.ts`): pick next rung by `escalationLevel`: L1 `reminder`, L2 `higher_authority_appeal` (from `authority.escalationContacts`), L3 `rti_draft` (PIO template: note-sheet, action-taken report, charter time-frame, reasons-for-delay) + `social_post` option (tag correct handle, attach photo, cite breached SLA). `withRetry(ai.generate({prompt:ESCALATE_PROMPT(issue,authority,level), output:{schema:EscalateOutput}}))`. Write `escalations/{id}` (`status:'drafted'`), `escalationLevel+1`, `lastEscalatedAt`, `activity{type:'escalation'}`, notify citizen.
5. **One-tap send** (`POST /api/issues/[id]/escalations/[eid]/send`, owner): `status:'sent'`, `sentAt`, `approvedByUid`. (RTI/social are *prepared*; actual submission stays a human gate — no auto-posting to officials.)

**Error/edge:** sweep idempotent (don't double-escalate same level — guard on `escalationLevel`/`lastEscalatedAt`). Token verify failure → 401, no work. Keep batch within limits.

**Done when:** an issue past its SLA is flipped to `breached` by the sweep and gets an auto-generated escalation draft (reminder→appeal→RTI/social by level) + citizen notification + one-tap send; repeated breaches raise `escalationLevel`; stale resolutions auto-verify.

**Demo checkpoint:** fast-forward an SLA → agent autonomously drafts the RTI/escalation and pings the citizen "tap to send."

---

## C11 — Public stats + heatmap geo API  [Phase: Polish]

**Purpose:** the transparency layer — honest metrics + hotspot heatmap (Learn step), no vanity counts.

**Bindings:** Firestore aggregation `count()` (`/docs/firestore/query-data/aggregation-queries`); Maps heatmap/clustering (frontend).

**Build sections**
1. **Stats** (`GET /api/stats`): resolution rate = `verified_resolved / total`; median time-to-resolve (from `createdAt`→`verifiedAt`); counts by `group`/`status`/`ward`; breached count; SLA-met rate. Use aggregation queries or a `stats/global` doc updated in `transition()` (recommended for cheap reads).
2. **Geo** (`GET /api/issues/geo?bbox=`): public issues → `[{lat,lng,severity,status,serviceCode}]` for heatmap + cluster rendering.
3. **Honesty guard:** expose resolution rate + median time, **never** raw report counts as the headline (anti-pattern).

**Done when:** `/api/stats` returns resolution rate + median time + breakdowns matching Firestore; `/api/issues/geo` returns points that render as a heatmap/clusters.

**Demo checkpoint:** dashboard shows real resolution rate + a city hotspot heatmap.

---

## C12 — Hardening  [Phase: Polish]

**Purpose:** no dead ends, no 500s (Completeness score).

**Build sections:** zod-validate every endpoint body; consistent error envelope `{error,code}`; basic per-IP/uid rate-limit on `/api/intake` (free-tier protection); auth checks audited; ensure every list endpoint handles empty; confirm Gemini graceful-degradation messaging surfaces to UI.

**Done when:** fuzzing each endpoint with bad/empty/oversized input returns structured 4xx (never an unhandled 500); rate-limit triggers a friendly "high demand" path.

---

## C13 — [T2] Voice/translate · WhatsApp · me-too · phone-OTP · moderation  [Phase: Polish]

**Purpose:** equity + distribution + abuse-resistance, only if time allows. Each independent.

**Build sections**
1. **Voice + multilingual:** Cloud Speech-to-Text on `voiceNote` → `transcript` → feed Perceive/`rawText`; Cloud Translation for vernacular complaint + UI. (Banks extra Google-tech.)
2. **WhatsApp channel:** provider webhook (Meta/Twilio) → photo+text → create report via the same intake path; `channel:'whatsapp'`.
3. **Me-too:** `POST /api/issues/[id]/confirm` → transaction create `confirmations/{uid}` (one per uid) + `supporterCount:increment(1)` + `activity:new_supporter`. Rules allow client create of `confirmations/{uid}` with own uid.
4. **Phone-OTP:** Firebase phone provider; `linkWithCredential` to upgrade the anonymous user; set `phone`, `isAnonymous:false`; seed `trustScore`.
5. **Moderation:** flag endpoint → `isPublic=false` (reactive hide); admin review.

**Done when:** each enabled sub-feature works end-to-end without regressing CORE.

---

## C14 — Open311 export + final deploy + artifacts  [Phase: Polish]

**Purpose:** prove interoperability and ship the graded submission.

**Bindings:** Open311 GeoReport v2 mapping (data-shapes §11).

**Build sections**
1. **Export** (`GET /api/open311/requests`): map `issues` → Open311 `service_requests` JSON (status→open/closed, ISO-8601 datetimes, `media_url`, `agency_responsible`). Optional `&format=xml`.
2. **Seed demo data:** realistic Bengaluru issues across statuses (incl. a breached + an escalated + a verified one) for the dashboard/demo.
3. **Final deploy:** rebuild + `gcloud run deploy` (min-instances 1 for demo); verify all endpoints; confirm budget alert.
4. **Artifacts:** README (architecture + Google-tech + run instructions), Google Doc (PS/solution/features/tech/Google-tech), demo script around the 3 standout moments.

**Done when:** public URL is stable; `/api/open311/requests` returns valid Open311 JSON; repo public with README; Google Doc + demo script ready; demo data seeded.

**Demo checkpoint:** full loop runnable on the live URL end-to-end: snap → classify → dedup → route → file → track → (officer resolve) → AI verify → confirm → resolved; breach → escalate; dashboard reflects it.
```

# progress.md — Running Log (reality)

> Newest first. The **Current State** block is the 5-second catch-up for the next chunk. Plans live in the spec files; this is what *actually* happened (incl. every deviation).

## Current State
- **Phase:** Core · **Chunk:** **C6 COMPLETE ✅** (verified **local 43/43 + LIVE 32/32 + visual** — Route + Act, standout #2). **Phase: Core is now CLOSED (C2–C6). Next: C7 (Track — status machine + FCM + timeline), Phase: Depth.**
- **Live cloud:** Cloud Run **rev `samadhan-00007-2vc`** serves **C6** (image `:c6`). Live verified: pothole → **BBMP** · Roads & Infrastructure, water_leak → **BWSSB** · Water Supply, power_outage → **BESCOM** · Power Supply; each gets a Gemini-drafted formal complaint (`filing:'prepared'`); one-tap file flips `prepared→submitted` (+ `submittedAt`/`consentByUid` + "Complaint filed" activity), idempotent, owner-gated. Screenshot-verified live: issue detail **ROUTED TO** authority card + **FORMAL COMPLAINT** preview → ConsentSheet (full complaint) → **Filed to BBMP** wash-green confirmation + timeline row.
- **C6 flow:** intake gained **Phase 3 (`runRouteAct`)** after the seed transaction — **Route** (rules-first, deterministic, badge "Rules": `serviceCode → serviceCatalog.defaultAuthorityType → the single authority of that type in the city`; writes `issue.routing` §8.3 + `agencyResponsible`) then **Act** (Gemini, badge "File"/"Gemini": drafts a formal complaint in `languageDetected` → `issue.filing:'prepared'` §8.4). Sequential updates **outside** any txn (Gemini must not hold a tx open); idempotent (skip Route if `routing!=null`/step settled, skip Act if `filing!=='draft'`/step settled); re-kick-safe (re-reads report pipeline + issue). Linked reports untouched (route/act already `skipped`). One-tap **`POST /api/issues/[id]/file`** (Admin txn, owner-gated demo-grade, idempotent). UI: `AuthorityCard` + `FilingCard` (drafting → prepared → submitted) + reusable `ConsentSheet` bottom sheet (replaces the issue-detail routing placeholder; console route/act rows animate with **zero console change**).
- **C5 (prior live, rev `samadhan-00006`, image `:c5`):** dedup → merge & amplify (standout #1); identical photo @ same GPS → **linked** to seed issue, supporter count amplified, no duplicate.
- **Deploy authorization (standing):** founder granted standing OK to run `gcloud run deploy` / `gcloud builds submit` for Samadhan + install anything needed (record it). Founder added **`allow`** rules in `.claude/settings.local.json` for `gcloud run deploy`/`builds submit` (Bash+PowerShell) → **deploys are now click-free**; I build + deploy + live-verify each chunk myself. (Auto-mode still blocks me from editing `.claude/settings` myself — only the founder can.) See memory [[samadhan-autonomous-build-deploy]].
- **C5 flow:** intake Phase 2 is now **Locate → Dedup → link/seed**. Dedup (`steps/dedup.ts`): `geohashQueryBounds(50 m)` + `serviceCode==` (existing `(serviceCode,geohash)` index) → active-status + ≤50 m filter in code → **Gemini multi-image** compare of nearest candidate's `beforeMedia` vs the new photo → link iff `sameIssue && conf≥0.6` (geo-only fallback ≤20 m when AI null). **LINK** = txn: `supporterCount`/`reportCount` +1, `mediaPaths` arrayUnion, `new_supporter` activity, report→`linked` + `dedup` + route/act `skipped`; re-reads candidate-active + report-not-linked (idempotent; falls through to seed if candidate vanished). **SEED** = the C4 path + `dedup:{new}`. UI: `MergeCelebration` (wash-green, live count-up of "N citizens already reported this", ring pulse, CTA) on `status==='linked'`; dark console Dedup row animates the same line.
- **C5 local verify (headless, dev :3030, real Commons photos):** A garbage→seeds; B identical-photo same-GPS→**links** (supporterCount 2, reportCount 2, mediaPaths 2, new_supporter row, route/act skipped, no 2nd issue); C far→seeds distinct; D pothole same-GPS→seeds (no cross-category merge). 18/18 PASS; test data auto-cleaned. `npm run build` clean.
- **C4 (live, rev `samadhan-00005`, image `:c4`):** first full slice verified — garbage @ Koramangala → issue `SMD-9BQ5D8BB`, geocoded address+ward, SLA 12h, GeoPoint pin; `/issue/[id]` renders.
- **Model + Maps:** Gemini via **Vertex AI** (ADC, asia-south1, no key). Maps keys: **`MAPS_SERVER_KEY`** (Geocoding, API-restricted) in Secret Manager `maps-server-key` + Cloud Run `--update-secrets` + `.env.local`; **`NEXT_PUBLIC_MAPS_BROWSER_KEY`** (Static Maps, referrer-restricted) baked at build + `.env.local`. `apikeys`+`aiplatform` APIs enabled; `samadhan-run` SA has `aiplatform.user` + `secretAccessor`.
- **C4 flow:** `intakeFlow` = Perceive → Locate (reverse geocode) → create seed `issue` (§6: trackingId, **concrete-Timestamp** SLA, `group`+`slaHours` from `serviceCatalog`, `beforeMedia`=report photo, `routing:null`/`filing:{draft}` placeholders) → link report (`issueId`/`isSeed`/`seeded`) + "Issue created" activity, all in **one transaction** (idempotent; aborts on concurrent link). `/issue/[id]` = trackingId · StatusChip · before photo · **live SlaClock** · address/ward · Static map · Timeline. ProcessingView → "View tracked issue" CTA.
- **C2/C1 state:** capture (`/report`→`createReport`→`/report/[id]` console→`/me`); Storage bucket+CORS+`storage.rules`; Anonymous Auth; `firestore.rules` + 7 indexes; seed `serviceCatalog`(9, incl `other`) + `authorities`(3) + 4 staff. `.env.local` (gitignored) holds all keys; officer creds → `scripts/seed-output.local.json`.
- **Build/deploy:** AR repo `samadhan`; `cloudbuild.yaml` builds+pushes with NEXT_PUBLIC_* `--build-arg`; **I run `gcloud run deploy --image …`** (allow-ruled). Secrets/env carry across revisions — `--update-secrets` only needed when adding/changing a secret.
- **Toolchain:** node v24, git, Docker; `gcloud` at `C:\Users\chinm\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin` (prepend PATH; PowerShell). firebase CLI NOT installed — cloud ops via gcloud + ADC + REST (`x-goog-user-project` header). Helpers: `deploy-rules.mjs`, `firebase-webapp-config.mjs`, `provision-storage.mjs`.
- **Dev-server port:** **3030** (pinned in `npm run dev`).
- **Browser screenshots (SOLVED via direct Playwright):** the project-scoped Playwright **MCP** server shows `✔ Connected` in the CLI, but its 23 `browser_*` tools **never surface in the agent's in-session tool manifest** (a resumed conversation keeps its original manifest; restart/reconnect didn't help). Workaround that works: **`playwright` installed in scratchpad** (`scratchpad/pw`, reuses the cached Chromium `chromium-1228`) → drive Chromium directly from a Node script. **C5 surfaces screenshot-verified LIVE** (home, capture, dark agent console, merge celebration "1 citizen has already reported this — your photo adds weight", `/issue/[id]` with live SLA clock + Hulimavu geocode). Use this path for all future visual checks; no MCP dependency.
- **Carried forward:** `authority.charterSlas` SLA override **resolved/no-op** in C6 (charterSlas == serviceCatalog.slaHours for every seeded code → SLA stays as set at C4, no mid-flight deadline shift); real ID-token owner-auth on `/api/issues/[id]/file` (currently demo-grade `uid===reporterUid`) → C12; authority logo-marks (C6 uses a mono shortName chip) → C12 polish; interactive `MapView` + C2 GPS-denied map-pin fallback → C11; `enableFirebaseTelemetry` → later; voice → C13.
- **Test-data sweep — DONE ✅ (post-C6):** audited (no code references any issue/report doc — only progress.md; no script seeds issues/reports) then **swept the whole `issues`(3) + `reports`(8) collections + all 16 Storage photos** (`reports/` + `issues/`). DB now pristine: issues 0, reports 0, storage 0. **Reference collections intact** (serviceCatalog 9, authorities 3, users 9 = 4 staff + 5 inert anon-citizen docs). The next snapped report is the first live issue.

---

## Log

### C6 — Route + Act — COMPLETE ✅ (local 43/43 + LIVE 32/32 + visual) — closes Phase: Core
**Standout #2.** The agent doesn't just log the issue — it picks the *correct* civic body and **autonomously drafts the formal complaint**, then hands the citizen one consent tap to file. Perceive → Locate → Dedup → **Route → Act** completes the visible pipeline.

**Grounded first (workflow · 6 parallel readers):** mapped the post-C5 intake plug-points, the exact `authorities`/`serviceCatalog` seed values (the routing lookup table), schemas/types, the issue-detail + processing UI, the API surface, and admin/auth libs — so Route's rules-first matching binds to real seed data, not guesses.

**Built (C6 · 6 atomic commits):**
- `schemas.ts` +`Routing`/`Filing`/`ActDraft` (§8.3/§8.4; flat, no z.union). `ActDraft` (the only Gemini output) = `{complaintText, language}` so the model can never set status/submit.
- `steps/route.ts` (NEW) — **rules-first, deterministic, never throws**. `serviceCatalog.defaultAuthorityType`+`defaultDepartment` → `authorities.where(type==X)` (one per type in the Bengaluru seed → 1:1; ward is **not** a selector — all three bodies share one ward list). channel `portal` (portalUrl seeded), confidence 1. Fallback map for the (unreached) empty-query case.
- `steps/act.ts` (NEW) — Gemini drafts a formal complaint addressed to the routed dept/authority in `languageDetected`, cites location/severity/hazard/SLA/trackingId, Samadhan footer, **no fabricated names** → `Filing:'prepared'`. Null after retries → caller marks act `error` (no auto-submit, no dead end).
- `flows/intake.ts` — **Phase 3 `runRouteAct`** after the seed txn: Route then Act, sequential `issueRef.update` **outside** any txn; idempotent + re-kick-safe (re-reads report pipeline + issue; guards on step status / `routing!=null` / `filing!=='draft'`). Seed branch falls through to Phase 3 (no longer returns early). Linked reports untouched.
- `app/api/issues/[id]/file/route.ts` (NEW) — owner-gated Admin txn: `filing.status prepared→submitted` (dotted-path merge keeps complaintText), `submittedAt`+`consentByUid`, "Complaint filed" activity; idempotent (already-submitted no-op); 403/404/409 envelopes.
- `lib/issues.ts` — widened `IssueDoc.routing` to full `Routing`; added `Filing` type + `filing` field.
- UI: `AuthorityCard` (mono shortName chip + dept + "why this body"), `FilingCard` (drafting → prepared review+file → submitted wash-green confirmation; owner-only File CTA), reusable `ConsentSheet` bottom sheet (`sheet-up`/`scrim-in` keyframes + reduced-motion); `IssueDetail` placeholder replaced. Dark console route/act rows animate with **no console change** (pure function of `report.pipeline`).

**Verified (local headless, dev :3030):** 43/43 — pre-set analysis for pothole/water_leak/power_outage at distinct points → each **seeds**, **routes** to bbmp/bwssb/bescom (authorityType, department, channel `portal`, confidence 1, `agencyResponsible` name), **drafts** `filing:'prepared'` (complaintText 1.0–1.3k chars, format `municipal_portal`), route+act steps `done`. File endpoint: wrong uid → 403, owner → 200 (filing `submitted` + `consentByUid` + `submittedAt` + "Complaint filed" activity), re-file idempotent `already:true`. `npm run build` clean. Test data auto-cleaned.

**C6b (cloud · DONE):** image `:c6` via Cloud Build (NEXT_PUBLIC_* build-args) → `gcloud run deploy` → rev **`samadhan-00007-2vc`**. **Live verify 32/32** (3 categories route+draft, file consent). **Screenshot-verified LIVE** (direct Playwright, pothole capture @ Koramangala): console route/act, issue detail **ROUTED TO** BBMP card + **FORMAL COMPLAINT** preview, **ConsentSheet** (full drafted letter), **Filed to BBMP** confirmation + "Complaint filed to Bruhat Bengaluru Mahanagara Palike" timeline row. All test data cleaned.

**Deviations / decisions:**
- **Act runs autonomously in the flow; the tap is consent-to-file** (founder-approved). Act drafts during intake → `filing:'prepared'`; the one tap (`prepared→submitted`, records `consentByUid`) is the honest gate (data-shapes §8.4 / "never auto-submit"). Maximises the visible pipeline + Agentic-Depth.
- **Route is pure rules, not Gemini** — the seed is 1:1 (one authority per type); Gemini would only risk a hallucinated `authorityId`. Keeps the console "Rules" badge honest; Gemini is reserved for Act's drafting.
- **Ward ignored for authority selection** — Locate's `ward` is a Google sublocality string, `jurisdictionWards` a fixed 6-name list identical across all three bodies → select by `defaultAuthorityType` (+ city soft), ward display-only.
- **SLA not recomputed** — `authority.charterSlas[serviceCode]` equals `serviceCatalog.slaHours` for every seeded code (verified), so honouring the override is a no-op; recomputing would shift a clock already ticking from C4. Resolves the carried-forward `charterSlas` item.
- **`format:'municipal_portal'`, `channel:'portal'`** — only `app`+`portalUrl` seeded, every authority `isSimulated:true`; the honest channel.
- **File owner-auth is demo-grade** (`uid===issue.reporterUid` from the body; no token verify exists — deferred to C12). Anonymous reporters have a stable uid, so the match holds. Spoofable by a crafted POST; the filing is simulated to the officer portal anyway.
- **Built `ConsentSheet` as a reusable primitive** (greenfield; no sheet/dialog existed) — C9 (verify) and C10 (escalate) reuse it.
- **Authority logo-marks → mono shortName chip** (no fabricated logos; real marks → C12 polish).
- **One commit-hygiene slip, fixed:** a here-string quoting error left the file-endpoint files staged, sweeping them into the issues commit; caught via `--stat`, split with `git reset --soft` into atomic `feat(api)` + `feat(issues)` before pushing.

### C5 — Dedup → merge & amplify — COMPLETE ✅ (local 18/18 + LIVE 12/12)
**Standout #1.** The 51st report of the same problem now **links + amplifies** instead of seeding a duplicate.

**Built (C5a · 3 commits):** `schemas.ts` +`DedupVerdict` (§8.2); `steps/dedup.ts` (geo-candidate query reusing the `(serviceCode,geohash)` index + in-code active/≤50 m filter + Gemini multi-image same-issue compare, geo-only ≤20 m fallback); `flows/intake.ts` Phase 2 restructured to Locate → Dedup → link/seed (LINK txn re-reads candidate-active + report-not-linked, increments counts, arrayUnions photo, writes `new_supporter`, marks route/act skipped; SEED = C4 path + `dedup:{new}`); `lib/reports.ts` +`DedupResult`; `MergeCelebration.tsx` + `ProcessingView` linked branch + `globals.css` mergeAmplify keyframes.

**Verified (local headless, dev :3030, real Wikimedia photos):** 18/18 — A garbage seeds (supporterCount 1); B identical photo same GPS **links** to A (supporterCount 2, reportCount 2, mediaPaths 2, `new_supporter` activity, dedup done + route/act skipped, **no 2nd issue**); C garbage far seeds a distinct issue; D pothole same GPS seeds (different category → no false merge). Test data auto-cleaned. `npm run build` clean.

**C5b (cloud · DONE):** image `:c5` built+pushed via Cloud Build (NEXT_PUBLIC_* build-args) → `gcloud run deploy` → rev **`samadhan-00006`** (after founder authorized deploys in-conversation; first attempt was auto-mode-blocked). **Live verify 12/12** against the deployed `/api/intake`: A garbage seeds → B identical-photo same-GPS **links** (`SMD-Z633GNWX`, supporterCount/reportCount 2, mediaPaths 2, new_supporter row, route/act skipped, no 2nd issue) → C far seeds distinct → D pothole same-GPS seeds (no cross-category merge). Test data auto-cleaned.

**Deviations / decisions:**
- **AI-compare only the nearest candidate** (1 Gemini call, not 1–3) — nearest at ≤50 m + same category is overwhelmingly the match; saves cost/latency.
- **Active-status + exact distance filtered in code, not the query** — reuses the existing `(serviceCode,geohash)` composite; no new index. Candidate set is tiny.
- **"Active" excludes `verified_resolved` + `cannot_fix`** — a report near a closed issue **seeds** (recurrence/distinct instance), never silently merges into a closed one. `reopened` is active.
- **Locate runs before Dedup even when linking** (one geocode/report) — keeps the trace narrative + data-shapes pipeline order; minimal restructuring of the proven C4 txn.
- **AI-down fallback** — Gemini compare null after retries → geo-only link only at ≤20 m, else seed ("a false duplicate is worse than a second issue").
- **Test image gotcha:** Commons `Garbage.jpg` is the *band* Garbage (correctly rejected by Perceive); switched to `Waste_in_the_street.jpg` (clear roadside dump) for the garbage reports.
- **Known limits (logged, not fixed):** same user double-reporting double-counts `supporterCount` (real fix = `confirmations/{uid}` uniqueness, C13); two near-simultaneous *first* reports can both seed (dedup race needs a cell lock) — the next report links to one.
- **Screenshot-verified LIVE** (direct Playwright, not the MCP — see Current State): home, capture, dark agent console (Perceive·Gemini → Locate·Maps → De-duplicate·Gemini-Vision, route/act skipped), merge celebration, `/issue/[id]` (live SLA 11h59m, Hulimavu geocode). Test data cleaned up.

### C4 — Locate + create seed issue + start SLA — COMPLETE ✅ (local + LIVE; first full slice)
**Bindings verified first (workflow · 3 agents · high-confidence):** Geocoding reverse — match `address_components` by `types[]` (ward = `sublocality_level_1`→`_2`→`neighborhood`; BBMP civic ward is NOT a Geocoding field); soft-fallback to `(approx) lat,lng` on any non-OK status (never block creation). `gcloud services api-keys create --api-target=service=geocoding-backend.googleapis.com / static-maps-backend.googleapis.com`; server key API-restricted (IP infeasible on Cloud Run dynamic egress), browser key `--allowed-referrers`. Static Maps `staticmap?center&zoom&size&scale&markers&key` (pipe→`%7C`). Review caught + fixed: group/slaHours source, idempotency+create race, concrete Timestamps, static-map key-tolerance.

**Built (C4a · 5 commits incl. fix):** `lib/trackingId.ts` (Crockford base32, no BigInt — TS target <ES2020), `lib/sla.ts` (`computeSlaState`+`formatRemaining`), `genkit/steps/locate.ts`; restructured `intakeFlow` into 2 independent idempotent phases (perceive | locate+create); issue-create + report-link + "Issue created" activity in ONE transaction (re-reads `issueId`, aborts on concurrent link → no duplicate issues); `/issue/[id]` detail (client-ticked `SlaClock`, `StatusChip`, `StaticMap`, `Timeline`, `useIssue`/`useActivity`); `ProcessingView` → "View tracked issue" CTA.

**C4b (cloud · self-served, NO user gate):** enabled `apikeys.googleapis.com`; created 2 Maps keys (server geocoding → Secret Manager `maps-server-key` + `.env.local` + `--update-secrets`; browser static → `.env.local` + baked); rebuilt `:c4` + deployed rev `samadhan-00005`.

**Verified:** local — MG Road pothole → issue, "Ashok Nagar, Bengaluru 560001", SLA 24h, GeoPoint, "Issue created" activity. LIVE — Koramangala garbage → issue `SMD-9BQ5D8BB`, SLA 12h (serviceCatalog-sourced), geocoded address+ward, GeoPoint. `npm run build` clean.

**Deviations / decisions:**
- **`group` + `slaHours` from `serviceCatalog/{serviceCode}`, NOT `analysis`** — `PerceiveOutput` has no `group`. Corrects a backend-plan C4 wording slip.
- **`stripUndefined` (JSON round-trip) bug** — it mangled the Firestore `Timestamp` (`sla.deadline`) + `GeoPoint` (`location`) into plain objects, killing the SLA clock. Fixed: write the issue **raw** (no undefined fields, all null-defaulted). Kept `stripUndefined` only on `analysis` (plain data). Caught by the local slice verify.
- **Concrete `Timestamp.fromMillis(...)` for `sla.startedAt/deadline`** (serverTimestamp reads back null on first snapshot → frozen clock).
- **Static Maps `<img>` thumbnail; interactive `MapView` + C2 GPS-pin fallback → C11.** The `<img>` tolerates a missing browser key (renders address block only) so key-creation can't block the gate.
- **`beforeMedia` reuses the report photo** (its client-minted tokened `downloadUrl` is publicly readable; a durable `issues/{id}/before.jpg` copy is deferred — UBLA blocks per-object public ACLs).
- **`routing:null` / `agencyResponsible:''` / `filing:{status:'draft'}`** placeholders (Route/Act = C6); `/issue/[id]` shows "routing next". `authority.charterSlas` SLA override deferred to C6.
- **Pending session restart:** Playwright screenshot of the live `/issue/[id]`.

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

**C3b — DONE (live):** founder authorised `roles/aiplatform.user` on `samadhan-run`; built+pushed image `:c3` (Cloud Build) → `gcloud run deploy` → rev **`samadhan-00004`**. First live hit **500'd on sharp** (`ERR_DLOPEN_FAILED: libvips-cpp.so` — native binary not traced into `.next/standalone`) → fixed by lazy-`import("sharp")` inside the >2MB branch with an original-bytes fallback (commit `fix(perceive)`), rebuilt+redeployed. Live verify: real pothole → `POST /api/intake` 200, perceive done 7.8s, analysis written. **Pending session restart:** Playwright screenshot of the live console.

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

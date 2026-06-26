# progress.md — Running Log (reality)

> Newest first. The **Current State** block is the 5-second catch-up for the next chunk. Plans live in the spec files; this is what *actually* happened (incl. every deviation).

## Current State
- **Phase:** Depth · **Chunk:** **C9 — Verify — COMPLETE ✅ (local 14/14 + LIVE 14/14 + visual)**. **Standout #3 — the loop closes honestly.** On officer **resolve**, the agent runs an independent **Gemini before/after verdict** (`verification.aiVerdict`); the citizen sees the before/after + the verdict + a **Yes-it's-fixed / Still-broken** decision. Confirm → `verified_resolved` (the ONLY citizen path to closed; AI never auto-finalises); deny → `reopened` (SLA resumes). Live on Cloud Run **rev `samadhan-00013-8lh`** (image `:c9`). 4 atomic commits + the deploy/progress commit.
- **C9 build:** `genkit/schemas.ts` +`VerifyVerdict {resolved,confidence,sameLocation,reasoning}` (flat). `genkit/steps/verify.ts` (NEW) — `verify({beforeMediaPath,afterMediaPath})` mirrors the dedup multi-image pattern (Admin download → data URLs → `ai.generate` paired media + `withRetry`); `runVerify(issueId)` assembles `aiVerdict {resolved,confidence,reasoning, gpsMatch:=sameLocation, timestampMatch:=resolvedAt>createdAt, checkedAt}` and writes it best-effort (never throws). The officer **resolve** action `await runVerify(id)` after the resolve transition commits (so the verdict is on the issue when the citizen opens). `POST /api/issues/[id]/verify-confirm` (NEW, owner-gated demo-grade like `/file`): confirmed→`transition(→verified_resolved)`+`verification.{citizenConfirmed,outcome:'verified',confirmedByUid,finalizedAt}`; denied→`transition(→reopened)`+`outcome:'rejected'`; notifies the assigned officer; idempotent; 400/403/404/409. `lib/issues.ts` +`AiVerdict`/`Verification` fields. UI: `BeforeAfter` (NEW reusable pair; officer detail now uses it) + `VerifyCard` (NEW citizen — before/after, agent verdict card green/coral with location+timing check chips, Yes/Still-broken decision, `resolveBloom` celebration on verified_resolved) wired into `IssueDetail`; officer detail shows the verdict read-only; `resolve-bloom` keyframe.
- **C9 verified:** local **14/14** + LIVE **14/14** via a headless harness (real officer token + real before/after photos in Storage → the actual Gemini verdict runs): resolve writes a well-formed `aiVerdict`; **the agent correctly flagged mismatched proofs** (*"a completely different street with garbage"*, *"a concert… no relation to the pothole"*) → `resolved:false`; **citizen confirm → verified_resolved** (+verifiedAt+outcome+citizenConfirmed) **even when the AI said not-resolved** (proves AI is advisory, citizen finalises); re-confirm idempotent; deny → reopened (resolvedAt cleared, outcome rejected); owner gate (wrong uid→403); verify-confirm on a submitted issue→409; bad body→400. **Screenshot-verified LIVE** (direct Playwright, owner via anon-uid→admin-seed handshake): the citizen VerifyCard decision state (before/after both loaded, green "This looks resolved · 90% sure" + "Same location"/"Taken after the report" chips + Yes/Still-broken) + the **verified_resolved celebration** ("Fixed and confirmed — the loop is closed", resolveBloom). `npm run build` clean. Test issues swept → DB pristine (issues 0, reports 0).
- **C8 (rev `samadhan-00012-92b`, image `:c8`) — Officer portal + first real auth perimeter:** officer email/password login → support-sorted queue → acknowledge/assign/start/resolve(proof photo)/cannot-fix(note), each via `transition()`. `claims.ts` `requireOfficer` (verify Bearer ID token + role claim) + `assertJurisdiction`; `getAdminAuth`; `transition()` atomic `patch`; `/api/officer/queue` + `/api/officer/issues/[id]/action`; staff-write `storage.rules` for `issues/{id}/after/{file}`; `uploadAfterPhoto`/`publicStorageUrl`; `OfficerShell`/`OfficerQueue`/`OfficerIssueCard`/`OfficerActionBar`. Enabled the Email/Password auth provider. (Full detail in the C8 log entry.)
- **C7 (rev `samadhan-00011-rhv`, image `:c7d`) — loop spine done:** `transition()` state-machine + FCM web push + live timeline; **ON-DEVICE OS push confirmed** on a real Android Chrome phone. Two push bugs fixed (SW dedicated-scope registration via omitting `serviceWorkerRegistration`; **notification-payload + minimal SW** for background auto-display). `notify.ts`/`status.ts`/`fcm.ts`/`firebase-messaging-sw.js`/`Toast`/`FcmForeground`/`NotificationOptIn`/`BreachBanner`. (Full detail in the C7 log entry.)
- **C6 (live, rev `samadhan-00007-2vc`, image `:c6`) — Core closed:** Route + Act, standout #2 — pothole→BBMP / water_leak→BWSSB / power_outage→BESCOM (rules-first Route in intake Phase 3 → `issue.routing` §8.3 + `agencyResponsible`); Gemini-drafted formal complaint (`filing:'prepared'` §8.4); one-tap `POST /api/issues/[id]/file` flips `prepared→submitted`. UI: `AuthorityCard` + `FilingCard` + reusable `ConsentSheet`. (Full detail in the C6 log entry.)
- **C5 (image `:c5`):** dedup → merge & amplify (standout #1) — identical photo @ same GPS links to the seed issue, no duplicate. (Full detail in the C5 log entry.)
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
- **Auth (live):** Identity Platform providers enabled — **Anonymous** (C1) + **Email/Password** (C8, enabled via the same `identitytoolkit admin/v2/.../config` PATCH C1 used for anonymous; was `PASSWORD_LOGIN_DISABLED` and blocked the officer login). Officers/admin are real Auth accounts with **custom claims** `{role,authorityId,jurisdictionWards}` (C1 seed) — read both by `requireOfficer` (verified ID token) and by the Firestore/Storage `isStaff()` rules. Officer login = `/officer` email/password (seeded creds in `scripts/seed-output.local.json`).
- **Carried forward:** `authority.charterSlas` SLA override **resolved/no-op** in C6; **citizen** ID-token owner-auth on `/api/issues/[id]/file` + `verify-confirm` still demo-grade (`uid===reporterUid`) → **C12 retrofits them using the C8 `requireOfficer` pattern**; C9 **deny does not yet auto-escalate** + the verify **`outcome:'auto'` grace sweep** are the **C10** hook; authority logo-marks (mono shortName chip) → C12; interactive `MapView` + C2 GPS-denied map-pin fallback → C11; `enableFirebaseTelemetry` → later; voice → C13. **C10 still needs the founder's one IAM grant** (`roles/run.invoker` for the Scheduler SA).
- **Test-data sweep — DONE ✅ (post-C6):** audited (no code references any issue/report doc — only progress.md; no script seeds issues/reports) then **swept the whole `issues`(3) + `reports`(8) collections + all 16 Storage photos** (`reports/` + `issues/`). DB now pristine: issues 0, reports 0, storage 0. **Reference collections intact** (serviceCatalog 9, authorities 3, users 9 = 4 staff + 5 inert anon-citizen docs). The next snapped report is the first live issue.

---

## Log

### C9 — Verify (standout #3) — COMPLETE ✅ (local 14/14 + LIVE 14/14 + visual)
**The loop closes honestly.** The officer's proof isn't trusted blindly: the agent runs an independent before/after verdict, the citizen sees it, and only the citizen's tap finalises `verified_resolved`. AI never auto-closes (data-shapes §8.6).

**Grounded first:** read the proven Gemini multi-image pattern in `steps/dedup.ts` (mirrored exactly), `genkit/index.ts` (`ai`/`MODEL`), `lib/retry.ts`, `geo.ts` (`distanceMeters`), the C8 resolve path + `/file` owner-gate pattern.

**Built (C9 · 4 atomic commits):**
- `genkit/schemas.ts` +`VerifyVerdict {resolved, confidence, sameLocation, reasoning}` (flat, no z.union).
- `genkit/steps/verify.ts` (NEW) — `verify()` (Admin-download before+after → data URLs → `ai.generate` paired media + `VERIFY_QUESTION` + `withRetry`) + `runVerify(issueId)` (guards status/after-photo, assembles `aiVerdict`, writes `verification.aiVerdict`, best-effort never-throws).
- `app/api/officer/issues/[id]/action/route.ts` — resolve branch `await runVerify(id)` after the transition commits (inline so the verdict is present when the citizen opens; the resolve already committed so a verify failure is harmless).
- `app/api/issues/[id]/verify-confirm/route.ts` (NEW) — owner-gated (`uid===reporterUid`, demo-grade like `/file`): confirmed→`transition(→verified_resolved)`+`verification.{citizenConfirmed,outcome:'verified',confirmedByUid,finalizedAt}`; denied→`transition(→reopened)`+`outcome:'rejected'`; notifies the assigned officer; idempotent; 400/403/404/409.
- `lib/issues.ts` +`AiVerdict` type + extended `Verification`. UI: `BeforeAfter` (NEW reusable labelled pair — officer detail refactored onto it) + `VerifyCard` (NEW citizen — before/after, agent verdict card (green "looks resolved"/coral "worth a closer look" + confidence + reasoning + location/timing check chips), Yes-it's-fixed / Still-broken decision, `resolveBloom` celebration on verified_resolved) wired into `IssueDetail`; officer detail shows the verdict read-only; `resolve-bloom` keyframe in `globals.css`.

**Verified (local headless dev :3030 → 14/14, then LIVE 14/14):** a harness that seeds in_progress bbmp issues with **real before/after photos in Storage** + a real officer token, drives the resolve (the actual Gemini verdict runs), then exercises confirm/deny: resolve writes a well-formed `aiVerdict`; **the agent flagged mismatched proofs** (pothole-vs-garbage-street, pothole-vs-concert) → `resolved:false`; **citizen confirm → verified_resolved** (+verifiedAt+outcome+citizenConfirmed) **even when the AI said not-resolved** (AI advisory, citizen finalises); re-confirm idempotent; deny → reopened (resolvedAt cleared, outcome rejected); owner gate (wrong uid→403); confirm on a submitted issue→409; bad body→400. **Screenshot-verified LIVE** (Playwright): the VerifyCard decision state (before/after both loaded, green "This looks resolved · 90% sure" + "Same location"/"Taken after the report" chips + Yes/Still-broken) + the verified_resolved celebration ("Fixed and confirmed — the loop is closed", resolveBloom). `npm run build` clean; test issues swept.

**C9b (cloud · DONE):** image `:c9` (Cloud Build, NEXT_PUBLIC_* build-args) → `gcloud run deploy` → rev **`samadhan-00013-8lh`**. Live API 14/14 + live Playwright pass.

**Deviations / decisions:**
- **`gpsMatch` = Gemini's visual *same-location* judgment, not device GPS** (D1) — the client downscale strips EXIF and the officer portal is simulated (the officer isn't at the issue, so device GPS would false-flag every legit resolve). The honest, demoable signal is "is the after photo the same place?" data-shapes §8.6 annotated.
- **Deny → `reopened` and stop** (D2), not auto-advance to `in_progress` — `reopened` is already an active officer-queue state, so the issue reappears for the officer to explicitly "Start work"; one citizen push, no misleading "work restarted".
- **Verify runs inline-awaited on resolve** (D3, best-effort post-commit) — guarantees the verdict exists when the citizen opens; the ~3–8s is visible "agent is verifying" work on the officer's resolve.
- **`verify-confirm` owner-auth demo-grade** (D4) → C12 retrofit with `requireOfficer`.
- **Escalation-on-deny + the `outcome:'auto'` grace sweep are the C10 hook** — C9 deny just reopens + notifies the officer.
- **The decision buttons are owner-gated** — the live visual used an anon-uid (read from IndexedDB) → admin-seed handshake so the browser owned the seeded issue; the buttons + the confirm→verified_resolved mechanic are also headless-proven.

### C8 — Authority / Officer portal — COMPLETE ✅ (local 20/20 + LIVE 20/20 + visual)
**The loop closes on screen.** The simulated municipal side + the project's first **real** server auth perimeter. An officer signs in, sees their authority's support-sorted queue, and drives acknowledge→resolve (with a proof photo) — every action through the C7 `transition()`, so the citizen's timeline + push fire unchanged. C1 had already done the hard part (seeded **custom claims**), so the honest `requireOfficer` (verify ID token + claim) cost little.

**Grounded first (3 parallel Explore readers):** confirmed claims ARE set on officers (`seed.mjs` `setCustomUserClaims`), NO token-verify machinery existed yet, the officer-queue composite index was live, issues already carry `verification:{required,beforeMediaPath}`, and the `users` self-update rule pins `role=='citizen'` (so the auth provider's `lastActiveAt` bump silently no-ops for officers).

**Built (C8 · 7 atomic commits):**
- `lib/claims.ts` (NEW) — `requireOfficer(req)` parses `Authorization: Bearer`, `getAdminAuth().verifyIdToken`, requires the `role` claim officer|admin → `{uid,role,authorityId,jurisdictionWards}`; `assertJurisdiction(officer,issue)` = authority match (admin passes; **ward not checked** — shared list + free-text `issue.ward`, mirrors C6). `firebase-admin` +`getAdminAuth`.
- `lib/status.ts` — `transition()` +optional atomic **`patch`** (merged in the same txn; status fields always win) → `assignedOfficerUid` on assign, `verification.afterMediaPath` on resolve.
- `app/api/officer/queue/route.ts` (NEW) — requireOfficer; `routing.authorityId==` + `status in [submitted,acknowledged,assigned,in_progress,resolved_pending_verification,reopened]` + `orderBy supporterCount desc` (deployed composite index); admin → all authorities (single-field sort, filter in code); lean DTO + counts.
- `app/api/officer/issues/[id]/action/route.ts` (NEW) — requireOfficer + assertJurisdiction; `acknowledge|assign|start|resolve|cannot_fix` → `transition()`; **resolve requires `afterMediaPath`** (400), **cannot_fix requires `note`** (400); `expectedFrom` guard; envelopes 400/401/403/404/409.
- `storage.rules` — staff-write match `issues/{id}/after/{file}` (image <5MB, `isStaff()` role-claim) ORs over the recursive `write:false`; **deployed** via `deploy-rules.mjs`.
- `lib/storage.ts` — generic `uploadImage(path,blob)` (refactor; `uploadReportPhoto` now wraps it) + `uploadAfterPhoto(issueId,uid,blob)` + `publicStorageUrl(path)`.
- `lib/auth-context.tsx` — `signInWithEmail`/`signOut`; `CitizenProfile` +officer claims (display-only). `lib/officer-api.ts` (NEW) — central Bearer-token fetch (`fetchQueue`/`officerAction`).
- UI: `OfficerShell` (AppShell routes `/officer` to it — denser, no citizen nav) · `/officer` page (gate → `OfficerLogin` email/password / `OfficerQueue`) · `OfficerQueue` (deep-green DarkFeatureBand + counts + filter chips + support-sorted list) · `OfficerIssueCard` (support count = the lever, SLA chip) · `/officer/issue/[id]` (citizen live hooks + before/after + action bar) · `OfficerActionBar` (status-gated buttons + resolve `ConsentSheet` after-photo + cannot-fix `ConsentSheet` note). `IssueDoc` +`verification`/`assignedOfficerUid`.

**Verified (local headless dev :3030 → 20/20, then LIVE 20/20):** a harness that **mints real officer ID tokens** (Identity Toolkit `signInWithPassword`, exercising the real `verifyIdToken`) seeds bbmp issues + asserts: no-token→401, citizen→403, **bwssb officer can't see/act on bbmp issues→403**, bbmp queue support-sorted (Y12<X5<Z1) + counts, acknowledge (status + `status_change` activity actorRole officer), assign (`assignedOfficerUid` set), start, **resolve without photo→400**, resolve+photo→`resolved_pending_verification` + `verification.afterMediaPath` + `resolvedAt`, cannot_fix without note→400, illegal `submitted→resolve`→409, **Storage rule** officer-write 200 / citizen-write 403. **Screenshot-verified LIVE** (Playwright): login card → support-sorted queue → detail (gated action bar + SLA clock + "Pothole → BBMP roads") → **resolve-with-proof sheet**. `npm run build` clean; test issues swept (DB pristine).

**C8b (cloud · DONE):** image `:c8` (Cloud Build, NEXT_PUBLIC_* build-args) → `gcloud run deploy` → rev **`samadhan-00012-92b`**. Live API 20/20 + live Playwright pass.

**Deviations / decisions:**
- **Real ID-token auth for officers** (not C7's body-uid trust) — claims already existed + the Storage after-photo rule requires the role claim anyway, so a real API perimeter just matches it. The citizen `file`/`verify-confirm` endpoints stay demo-grade → C12 retrofit reuses `requireOfficer`.
- **Email/Password provider had to be enabled** (project only had Anonymous from C1) — `PASSWORD_LOGIN_DISABLED` surfaced when minting the first officer token; enabled self-served via the `identitytoolkit admin/v2/.../config` PATCH (the same REST C1 used for anonymous). This also unblocks the real `/officer` login.
- **Jurisdiction by authority only** (D2) — ward gate would false-reject.
- **`transition()` optional atomic `patch`** (D3) — side-fields ride the status txn, no second round-trip.
- **After-photo client-upload → Storage** (D4), path passed to the action; only `verification.afterMediaPath` stored (per §8.6); the citizen-facing before/after render is C9.
- **Queue = server API; detail = client hooks** (D5) — authoritative sort/jurisdiction server-side; free live streaming on the officer detail via `isStaff()` reads.
- **Admin = super-officer** (D6) — no `authorityId`, queue spans all authorities, jurisdiction always passes.
- **Known limits (logged):** queue refetch (no socket); resolve trusts the client `afterMediaPath` targets this issue's after-folder (Storage rule restricts who can write there) → cheap C12 path-belongs check; seeded passwords are demo creds.

### C7 — Track: status machine + FCM + timeline — COMPLETE ✅ (local 21/21 + LIVE 4/4 + visual + ON-DEVICE push confirmed) — opens Phase: Depth
**The loop's spine.** A status state-machine (`transition()`) + FCM web push + the live citizen timeline. `transition()` is the shared primitive C8 (officer actions) / C9 (verify) / C10 (escalate/auto-verify) all call.

**Grounded first (workflow · 3 parallel readers):** mapped the Track-relevant code (most live-update plumbing already exists from C4/C6 — `useIssue`/`useActivity`/`SlaClock`/`Timeline`/`StatusChip` all live; `ActivityItem` already has `fromStatus`/`toStatus`; Timeline already renders `status_change`) and bound the FCM externals to official docs: web `getToken`/SW/`isSupported`, Admin `sendEachForMulticast` + the exact dead-token codes, and the **definitive VAPID answer (console-only, no API)**.

**Built (C7 · 6 atomic commits):**
- `lib/notify.ts` — `notifyUser`/`notifyReporter`: **data-only** `getMsg().sendEachForMulticast` (the SW renders one notification; a top-level `notification` payload double-fires on web), ≤500-token chunks, prune `messaging/registration-token-not-registered` + `messaging/invalid-registration-token` via `arrayRemove`. Best-effort, never throws. `issueLink()` = HTTPS click target. Server needs **no VAPID private key** (Admin auth via ADC; `firebasecloudmessaging.admin` already on `samadhan-run`).
- `lib/status.ts` — `transition(issueId,{to,actorUid,actorRole,note,expectedFrom})`: validates the §9 graph (`ALLOWED` map), Admin txn writes status/statusNotes/updatedAt + a `status_change` activity row (from/to/actor) + `resolvedAt`(→resolved_pending_verification)/`verifiedAt`(→verified_resolved); reopen clears both (SLA clock resumes). Pushes the reporter **after** the txn commits (network never inside a txn). Throws NOT_FOUND/ILLEGAL_TRANSITION/STALE_STATUS.
- `app/api/internal/transition/route.ts` — role-gated (officer/admin via `users/{actorUid}.role`) trigger = the C7 demoable status change; **C8 builds the real officer portal on the same `transition()`**.
- `public/firebase-messaging-sw.js` — **compat importScripts pinned to firebase 12.15.0** (modular SW needs bundling; Next serves public/ raw), config inlined (public NEXT_PUBLIC_*), `onBackgroundMessage`→`showNotification` + `notificationclick`→open the issue. Separate from `/sw.js` (no scope fight). `next.config.ts` adds its no-cache + `Service-Worker-Allowed:/` header.
- `lib/fcm.ts` (client) — `isSupported()`-gated `enableNotifications(uid)` (`Notification.requestPermission()`→`getToken({vapidKey, serviceWorkerRegistration})`→arrayUnion the token to the citizen's **own** `users/{uid}.fcmTokens`, rule-enforced — no insecure register endpoint) + `listenForeground`.
- UI: reusable `Toast` (provider/`useToast`, reused C9/C10) + global `FcmForeground` (foreground `onMessage`→toast; the SW only shows background) + `NotificationOptIn` (reporter-only, `isSupported`-gated, states default-CTA/on/denied/unsupported — no dead end) + `BreachBanner` (client-computed from the live deadline; the breach **sweep** is C10). Wired into `IssueDetail` + `layout` (ToastProvider + FcmForeground inside AuthProvider). Intake: notify the seed reporter on a dedup **link** (post-commit).

**Verified (local headless, dev :3030):** 21/21 — role gate (citizen→403), missing-field→400, illegal `submitted→verified_resolved`→409, unknown issue→404, full legal chain `submitted→acknowledged→assigned→in_progress→resolved_pending_verification→verified_resolved` (each 200 + status updated + a `status_change` row with from/to/actorUid/actorRole), `resolvedAt`/`verifiedAt` set, reopen clears both + `reopened→in_progress`, transitions non-blocking with a bogus reporter token. Both SWs serve 200 (`text/javascript`, `Service-Worker-Allowed:/`). `npm run build` clean. Test data auto-cleaned.

**C7b (cloud · DONE):** founder generated the Web Push (VAPID) public key in the Firebase Console (**provably console-only** — neither the Firebase Management nor FCM REST API exposes web-push certificates); baked as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in `.env.local` + the build substitution. Built `:c7` (Cloud Build) → `gcloud run deploy` → rev **`samadhan-00008-cr5`**. **Live verify 4/4** (`/api/internal/transition` role-gate 403, legal transition 200, `status_change` activity live) + **screenshot-verified LIVE** (direct Playwright): the open `/issue/[id]` **streamed** `submitted→…→resolved_pending_verification` — status chip → "Awaiting your confirm", `SlaClock` → "RESOLVED IN TIME" (resolvedAt set), timeline rows (Marked resolved → Work has started → Acknowledged → Issue created) appeared without reload. `notify()` executed on Cloud Run (SA has `firebasecloudmessaging.admin`) reaching FCM.

**C7c/d — on-device push debugging (rev `samadhan-00011-rhv`, image `:c7d`) — RESOLVED ✅:** the OS notification didn't display on a real Android Chrome phone despite FCM accepting every send. Cracked via a **verification workflow** (2 researchers · firebase-js-sdk source + W3C SW spec) + a **foreground-`onMessage`-toast test** (the toast appeared → delivery reaches the browser → fault isolated to background SW display). **Two real bugs fixed:** (1) **SW scope collision** — `firebase-messaging-sw.js` registered at scope `/` collided with the PWA `/sw.js` (SW registrations are keyed by scope → they replaced each other; `/sw.js` has no push handler → pushes silently dropped) → fix: omit `serviceWorkerRegistration` from `getToken` so the SDK auto-registers at the dedicated `/firebase-cloud-messaging-push-scope`. (2) **Background display** — data-only + `onBackgroundMessage` is unreliable on Android, and notification-payload + a handler shows nothing → fix: server sends a **`notification` payload** + the SW is **minimal** (`firebase.messaging()`, no `onBackgroundMessage`) so FCM auto-displays + click-opens `fcmOptions.link`. Plus opt-in button-state fix (`justEnabled` + on-mount silent re-mint). **On-device step (not code):** a stale push subscription survives reloads → a one-time **site-data reset** on the device re-subscribes under the corrected worker; a backgrounded fire then **popped the OS notification on the real phone — confirmed.** (Samsung battery/DND can also suppress; verify settings.) Debug test data swept (DB pristine).

**Deviations / decisions:**
- **Token registers client-side, not via `/api/fcm/register`.** The citizen update rule already allows a rule-enforced `arrayUnion` of own `fcmTokens` (more secure than a demo-grade Admin endpoint trusting a body uid). The Admin register route is deferred to C8 (officers can't self-write under the citizen rule). Pruning stays server-side in `notify()`.
- **C7's trigger is a role-gated `/api/internal/transition`, not the officer portal** (C8). Minimal, shares `transition()`, gates on the seeded staff `users/{uid}.role` (no token-verify yet — C12).
- **Data-only FCM messages** (SW renders) to guarantee exactly one notification on web (a `notification` payload + `onBackgroundMessage` showNotification double-fires).
- **SW is compat `importScripts` (pinned 12.15.0)**, not modular — Next serves public/ unbundled.
- **C7 does NOT do breach *detection*** — the banner is client-computed display; the scheduled sweep that flips stored `sla.state` + fires escalation push is **C10** (a `sla.ts` comment overreached; backend-plan is authoritative). C7 push fires on status transitions + the dedup-link event.
- **Built `Toast` as a reusable primitive** (greenfield) — C9/C10/dashboard reuse it.

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

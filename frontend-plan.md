# frontend-plan.md — Frontend + Design Build Spec

> The frontend half of every chunk (shared chunk numbers with `backend-plan.md`). Screen-by-screen, every control + state + the exact look/feel + motion.
> **Visual tokens are bound to `DESIGN.md`** (the Cohere system installed via getdesign) — it is the source of truth for colour/type/spacing/radius/components, exactly as `data-shapes.md` is for data. Never invent a token; take it from `DESIGN.md` and the semantic map in §A.2. Product intent: `what-to-build.md`. Rules: `CLAUDE.md` §5.

---

## §A. Design system (derived from `DESIGN.md`)

### A.1 Source & adaptation
`DESIGN.md` describes Cohere's **marketing** site (huge 96px heroes, editorial bands). We adapt it for a **mobile-first PWA product app** + an officer console + a public dashboard. Three adaptation rules:
1. **Scale display type down** — 96px/72px heroes only on the public dashboard/landing; in-app screens top out at 28–32px headings, 16px body.
2. **Cohere's `agent-console-card` is our hero component** — the live agent-thinking trace (perceive→locate→dedup→route→act) renders as that dark near-black panel with status chips + latency. This single mapping carries the "Agentic Depth" demo.
3. **Add civic-state semantics** (§A.2) — Cohere has no SLA/severity/status colours; we map them onto its palette with discipline (one accent family per meaning).

Keep Cohere's discipline: white canvas default, deep-green/navy bands for emphasis, **flat (no heavy shadows)**, depth via surface alternation + 1px hairlines + rounded media, coral/blue used *sparingly* as accents not surfaces.

### A.2 Colour → semantic map (bind these)
Raw values live in `DESIGN.md`. Our semantic assignments:

| Semantic | Token (DESIGN.md) | Hex | Use |
|---|---|---|---|
| Brand / trust / **resolved** / success | `deep-green` | `#003c33` | brand mark, verified-resolved, success bands, dark-feature-band |
| Primary CTA (on light) | `primary` | `#17171c` | pill buttons ("Report", "File", "Confirm") |
| Agent console surface | `primary` | `#17171c` | the live trace panel (white text) |
| Link / info / active step | `action-blue` | `#1863dc` | links, in-progress emphasis |
| **Due-soon** / attention / escalation accent | `coral` | `#ff7759` | SLA due-soon, "needs you", escalation chips |
| **Breached** / hazard / error | `error` | `#b30000` | SLA breached, hazard flag, validation |
| Canvas | `canvas` | `#ffffff` | default background |
| Card surface | `soft-stone` | `#eeece7` | issue cards, neutral blocks |
| Success wash | `pale-green` | `#edfce9` | resolved banners, confirm screens |
| Info wash | `pale-blue` | `#f1f5ff` | tips, agent-explanation callouts |
| Body text / muted / hairline | `ink` / `muted` / `hairline` | `#212121`/`#93939f`/`#d9d9dd` | text, metadata, rules |

**Status-chip colours** (issueStatus, data-shapes §9): `submitted`/`acknowledged`/`assigned` → ink on stone; `in_progress` → action-blue; `resolved_pending_verification` → coral ("needs your confirm"); `verified_resolved` → deep-green; `cannot_fix` → muted; `reopened` → coral.
**slaState:** `on_track` → deep-green, `due_soon` → coral (gentle pulse), `breached` → error-red, `met` → deep-green.
**severity:** `low` → muted, `medium` → coral-soft, `high` → coral; `hazard:true` → error-red badge.

### A.3 Typography (fonts + fallbacks)
Proprietary Cohere fonts aren't bundled (`DESIGN.md` Known Gaps) → use the documented fallbacks via `next/font/google`:
- **Display** (`CohereText` role) → **Space Grotesk** — hero/dashboard numbers, standout reveals.
- **Body/UI** (`Unica77` role) → **Inter** — all UI copy.
- **Mono label** (`CohereMono` role) → **IBM Plex Mono** — SLA clock, `trackingId` (SMD-XXXX), uppercase technical labels, step latencies.

App scale (down-scaled from DESIGN.md, keep tight tracking on display):
`display` 28px / `h1` 24px / `h2` 20px / `cardHeading` 18px / `body` 16px / `button` 14px·500 / `caption` 14px / `mono-label` 13px·`+0.28px`·UPPERCASE / `micro` 12px. Dashboard/landing may use 60–96px display per `DESIGN.md`.

### A.4 Spacing · radius · elevation (from `DESIGN.md`)
- **Spacing** 8px base: `xxs2 xs6 sm8 md12 lg16 xl24 xxl32 section80`.
- **Radius:** `xs4` (inputs/thumbs), `sm8` (chips/cards/sheets), `md16` (grouped blocks), `lg22` (signature media cards: before/after, hero photo), `pill32` (primary CTAs), `full` (status dots, avatars).
- **Elevation:** flat. Depth = surface alternation (canvas↔stone↔deep-green) + 1px `hairline`/`border-light` + rounded media. No heavy drop shadows (a single soft shadow allowed only on the floating Report FAB + bottom sheets).

### A.5 Tailwind theme mapping
Mirror `DESIGN.md` into `tailwind.config.ts` `theme.extend` as the single token bridge:
```
colors: { brand:'#003c33', primary:'#17171c', link:'#1863dc', accent:'#ff7759',
          danger:'#b30000', canvas:'#fff', stone:'#eeece7', wash-green:'#edfce9',
          wash-blue:'#f1f5ff', ink:'#212121', muted:'#93939f', hairline:'#d9d9dd' }
borderRadius: { xs:'4px', sm:'8px', md:'16px', lg:'22px', pill:'32px' }
fontFamily: { display:['Space Grotesk',...], sans:['Inter',...], mono:['IBM Plex Mono',...] }
```
All components consume these tokens — never raw hex in JSX.

### A.6 Motion system (the energy — `CLAUDE.md` §5 requires it)
Library: **Framer Motion** (`motion`). Honour `prefers-reduced-motion` (swap transforms for instant + opacity). Named, reusable animations:
- **`traceStep`** — each agent step row: fades/slides in (12px, 200ms), spinner while `running`, spinner→✓ morph on `done` with a latency count-up (mono); active step has a pulsing dot; a vertical connector draws between steps. *This is the demo centrepiece.*
- **`mergeAmplify`** (dedup standout) — the new photo card flies into the existing issue thread; `supporterCount` runs a count-up with a floating "+1"; brief deep-green ring pulse.
- **`slaTick`** — mono countdown updates every second; colour cross-fades on_track→due_soon→breached; `due_soon` adds a 2s-interval gentle pulse.
- **`fileConsent`** — bottom sheet slides up; primary pill has press-scale (0.97) + success check on confirm.
- **`resolveBloom`** (verified_resolved) — deep-green check blooms, before/after reveal wipes, light confetti burst (reduced-motion → static check + wash-green banner).
- **`reveal`** — section/card enter on scroll (opacity + 8px rise, staggered 60ms).
- **`pageTransition`** — issue card → detail shared-element (image + title morph).
- Micro: button press-scale, optimistic toggles, skeleton shimmer on every async surface, map pin drop + smooth pan-to-located.

### A.7 Iconography & imagery
Thin-line geometric icons (`DESIGN.md` "thin-line geometric illustrations") — use **Lucide** (stroke 1.5). Imagery = the citizen's own photos as rounded `lg22` media cards (Cohere `hero-photo-card`). No stock illustration clutter.

---

## §B. Information architecture

**Three surfaces, one Next.js app (App Router):**

| Surface | Routes | Auth | Shell |
|---|---|---|---|
| **Citizen PWA** (mobile-first) | `/` (home: map+feed), `/report`, `/issue/[id]`, `/me` | anonymous (auto) | bottom nav + top bar |
| **Officer portal** | `/officer`, `/officer/issue/[id]` | officer claim (C1) | sidebar/topbar (denser, desktop-leaning) |
| **Public dashboard** | `/dashboard` | none (public) | full-width editorial |

**Citizen app shell:** top bar (Samadhan wordmark left · language toggle `EN/हि` · notifications + profile right) over white canvas; **bottom nav** 3 zones — *Home* (map/feed) · centre **Report FAB** (deep-green pill, the one shadowed element) · *Activity* (My Reports). Nav hides on `/report` capture flow (full focus). Reduced chrome, lots of whitespace.

**Routing to agent steps / standout moments:** `/report` = Capture→Perceive→Locate→Dedup→Route→Act (the live pipeline); `/issue/[id]` = Track/Escalate/Verify lifecycle; `/officer` = the resolution side; `/dashboard` = Learn.

---

## §C. Component library (each maps to a `DESIGN.md` component)

| Component | DESIGN.md basis | Notes / states |
|---|---|---|
| `Button` | button-primary / -secondary / -pill-outline | variants: `primary` (near-black pill), `brand` (deep-green pill), `text` (underlined link), `outline` (pill-outline). States: default/hover/press(scale .97)/disabled/loading(spinner). |
| `AgentTraceConsole` | **agent-console-card** | dark `primary` panel, white text; rows = `StepRow{icon,label,summary,latency(mono),status}`; `traceStep` motion; integration badges (Gemini/Maps/Firestore) as small chips. Subscribes to `report.pipeline` (data-shapes §5). |
| `IssueCard` | product-card (stone) / capability-card | thumbnail (lg22), title, `StatusChip`, `SlaClock`, `SupporterBadge`, address·ward (caption). Tap → `pageTransition` to detail. |
| `SlaClock` | mono-label | live countdown, semantic colour (§A.2), `slaTick` motion; shows "breached by Xh" when past. |
| `StatusChip` | full-radius pill | semantic colour by issueStatus; tiny status dot. |
| `SupporterBadge` | mono + count-up | "🧍N citizens" → render as icon+count; `mergeAmplify` count-up. |
| `Timeline` | research-table (rule-separated rows) | from `issues/{id}/activity`; each row: icon, message, actor, relative time; newest top. |
| `BeforeAfter` | hero-photo-card pair | two lg22 media cards or a drag-compare slider; used in Verify + resolved state. |
| `MapView` | (Maps JS) | custom muted map style to match canvas; pin drop, marker clustering, heatmap layer (`@googlemaps/markerclusterer` + visualization). |
| `ConsentSheet` | contact-form-card (rounded white sheet) | bottom sheet for one-tap gates (File / Send escalation / Confirm fix); shows the drafted artifact (complaint/RTI/tweet) + primary pill. `fileConsent` motion. |
| `DarkFeatureBand` | dark-feature-band (deep green) | dashboard hero, standout reveals, officer header. |
| `StatCard` | research-table / capability-card | big mono number + label; `reveal` + count-up; dashboard. |
| `EmptyState`/`ErrorState`/`Skeleton`/`Toast` | flat + hairline | every async surface has all three; skeleton shimmer; toast for confirmations/errors. |
| `LanguageToggle` | button-pill-outline | EN/हि (C13 full i18n; ships as toggle from C1). |

**Global rule:** every interactive screen defines **empty / loading / error / success** states. A dead/placeholder screen is disqualifying (`CLAUDE.md` §5).

---

## §D. Screens, chunk by chunk

Format per screen: **Route · Purpose · (agent step / standout · chunk) · Layout · Elements · States · Motion · Data (data-shapes) · Done-when.**

### C0 — Foundation: tokens, fonts, shell skeleton, landing
- **Set up the design system:** `tailwind.config.ts` from §A.5; load Space Grotesk / Inter / IBM Plex Mono via `next/font`; base `Button` + tokens; `app/manifest.ts` (name "Samadhan", deep-green `theme_color #003c33`, 192/512 icons); `public/sw.js` registration.
- **Landing/health page** (`/`): branded splash on white canvas — wordmark (Space Grotesk display), one-line promise *"From report to resolution"*, deep-green `Report` CTA (stub), small footer. This is what's deployed to Cloud Run in C0.
- **Motion:** `reveal` on load. **Done-when:** deployed page renders with real fonts/tokens; Lighthouse PWA-installable check passes; no layout shift.

### C1 — Auth + app shell + categories
- **App shell:** top bar + bottom nav (Home / Report FAB / Activity); `LanguageToggle`. Anonymous sign-in on first load (silent); profile menu shows "Anonymous Citizen" + "Sign in to save" (phone-OTP stub).
- **Category reference UI:** the 8 `serviceCatalog` categories available to the capture flow (icons + names), read live.
- **States:** signing-in skeleton; offline banner. **Data:** `users/{uid}` (§2), `serviceCatalog` (§3). **Done-when:** shell navigates between Home/Report/Activity; user doc created; categories render from Firestore.

### C2 — Capture flow  · (Capture · C2)
- **Route `/report`** (full-screen, nav hidden). **Purpose:** frictionless on-ramp — photo + auto-GPS + optional voice, near-zero typing.
- **Layout:** big camera viewfinder / `<input capture="environment">` button (deep-green, thumb-reachable); below: auto-detected location chip (map mini-pin + address once geocoded), optional **voice note** mic button, optional one-line note field. Single primary pill **"Report this"**.
- **Elements:** Capture/Retake; location chip (tap → manual map-pin fallback); mic (hold-to-record, waveform); note input; submit.
- **States:** *permission needed* (camera/location prompts with rationale); *no GPS* → manual pin required; *uploading* (progress); *submitting* → transitions to C3 console; error (retry, never lose the photo).
- **Motion:** shutter feedback; location chip slides in when resolved; mic waveform.
- **Data:** creates `reports/{id}` (data-shapes §5, status `processing`, 5 pending pipeline steps), Storage upload §7, then `runFlow('/api/intake')`.
- **Done-when:** capture → upload → report doc created → routed to the live console; manual-pin fallback works.

### C3 — Live agent console  · (Perceive · C3) — *Agentic-Depth centrepiece*
- **Route `/report` (processing state) → result.** **Component:** `AgentTraceConsole` (dark `primary` panel).
- **Layout:** the citizen's photo (lg22) at top; below, the dark console with step rows: **Perceive · Locate · Dedup · Route · Act**, each with a Google-tech badge (Gemini / Maps / Firestore). Subscribes to `report.pipeline` via `onSnapshot` → rows animate live as the server writes them.
- **Elements:** per-row spinner→✓, summary text (e.g. "Pothole · high severity"), latency in mono; on completion a **result card** (category, severity badge, caption, hazard flag).
- **States:** *running* (`traceStep`); *rejected* (not a civic issue → friendly "couldn't recognise a civic issue — retake?"); *needs_review* (low confidence → "we'll take a closer look"); *rate-limited* ("high demand — queued"). 
- **Motion:** `traceStep` per row; active pulsing dot; connector draws downward.
- **Data:** `report.pipeline[]`, `report.analysis` (§8.1). **Done-when:** a real photo shows the Perceive step completing live with category/severity/caption; non-civic → rejected screen.

### C4 — Issue created → Issue Detail  · (Locate · C4) — *Demoable Slice #1*
- **Route `/issue/[id]`.** **Purpose:** the report becomes a tracked, deadlined issue.
- **Layout:** header (title, `StatusChip`, `trackingId` in mono); `BeforeAfter`→just the before photo (lg22); **`SlaClock`** prominent (live countdown, semantic colour); `MapView` mini with the located pin + address·ward; `Timeline` (starts with "Issue created").
- **Elements:** share, follow, back. **States:** loading skeleton; map fallback if geocode approx.
- **Motion:** console→detail transition; map pin drop + pan; `slaClock` starts ticking.
- **Data:** `issues/{id}` (§6), `activity`. **Done-when:** issue detail shows tracking ID, address/ward, a live SLA countdown, before photo, and the timeline.

### C5 — Dedup moment  · (Dedup · standout #1 · C5)
- **In the console + detail:** when Dedup matches, the console row reads **"14 citizens already reported this"**; the flow routes the citizen to the *existing* issue with a celebratory **"your photo adds weight"** panel (wash-green) and the `SupporterBadge` counting up.
- **Elements:** "View the issue 12 others reported" CTA; supporter avatars/stack. **States:** matched (link) vs new (seed → normal C4). 
- **Motion:** **`mergeAmplify`** — photo flies into the thread, counter count-up, deep-green ring pulse.
- **Data:** `report.dedup` (§8.2), `issue.supporterCount`. **Done-when:** a duplicate report shows the merge animation + incremented count and lands on the shared issue; a new one seeds normally.

### C6 — Route + Act (file consent)  · (Route, Act · standout #2 · C6)
- **In console + detail:** Route row reveals the **authority card** (BBMP/BWSSB/BESCOM logo-mark, department, "correct body" reasoning); Act row produces the **drafted complaint** → opens a `ConsentSheet` previewing the formal complaint (right language/format) with a single **"File to BBMP"** pill and the line *"…and the 24-hour SLA clock starts."*
- **Elements:** edit-before-file (optional), file pill, "why this authority?" expander. **States:** drafting skeleton; prepared; submitted (success toast + timeline entry); low-confidence route → "we picked X — change?".
- **Motion:** `fileConsent` sheet; success check.
- **Data:** `issue.routing` (§8.3), `issue.filing` (§8.4); `POST /api/issues/[id]/file`. **Done-when:** correct authority shown per category; drafted complaint readable; one-tap file flips to submitted + logs activity.

### C7 — Track: timeline, SLA, notifications  · (Track · C7)
- **Issue Detail (full):** `Timeline` of all `activity`; `SlaClock` with state colours + "breached by Xh"; **push-permission prompt** (rationale → `getToken`); status chip updates live via `onSnapshot`.
- **Elements:** enable-notifications CTA; follow/unfollow. **States:** notifications denied (in-app timeline still works); due_soon pulse; breached banner (coral→red).
- **Motion:** `slaTick`; timeline rows `reveal` newest-first; toast on push.
- **Data:** `activity`, `sla`, `users.fcmTokens`. **Done-when:** status change pushes a notification + updates the timeline live; SLA states render correctly.

### C8 — Officer portal  · (resolution side · C8)
- **Route `/officer`** (desktop-leaning, denser). **Queue:** `DarkFeatureBand` header (authority name, today's counts) over a list of `IssueCard`s **sorted by `supporterCount` desc**; filters (status, ward, category) as `button-pill-outline` chips; the support count is visually prominent (the lever that drives action).
- **`/officer/issue/[id]`:** full issue + **action bar**: Acknowledge → Assign(me) → Start → **Resolve** (requires after-photo upload) / Cannot fix (requires note).
- **Elements:** proof-of-fix uploader (camera/file); note field; action buttons gated by current status (state machine). **States:** empty queue; jurisdiction-denied; resolve-without-photo blocked (inline error).
- **Motion:** queue `reveal` stagger; action confirm.
- **Data:** `GET /api/officer/queue`, `POST /api/officer/issues/[id]/action`, after-media §7. **Done-when:** officer sees support-sorted queue, drives acknowledge→in_progress→resolved with a proof photo; each step notifies the citizen.

### C9 — Verify  · (Verify · standout #3 · C9)
- **Citizen Issue Detail (on `resolved_pending_verification`):** a **`BeforeAfter`** compare + an **AI verdict card** (the agent's read: "looks resolved · 0.86" *or* the standout flag **"the resolved photo doesn't match this location"** with gps/timestamp checks) + a `ConsentSheet`: **"Yes, it's fixed"** (brand pill) / **"No, still broken"** (outline).
- **Elements:** drag-compare slider; verdict reasoning expander; confirm/deny. **States:** awaiting-after-photo; AI flagged mismatch (coral/red) → recommend reopen+escalate; confirmed → `resolveBloom`.
- **Motion:** `BeforeAfter` wipe; **`resolveBloom`** on confirm; reopen → status returns to in_progress.
- **Data:** `issue.verification` (§8.6); `POST /api/issues/[id]/verify-confirm`. **Done-when:** before/after + AI verdict shown; confirm → verified_resolved (green bloom); deny/mismatch → reopened; AI never auto-closes.

### C10 — Escalate  · (Escalate · C10)
- **Citizen Issue Detail (on breach):** a **breach banner** (red) + an **escalation card** showing the agent's auto-drafted artifact by level — **Reminder → Higher-authority appeal → RTI draft / social post** — each in a `ConsentSheet` preview with a **one-tap "Send"** (and "Edit"). Shows the target (PIO / @handle / commissioner) and the cited breached SLA.
- **Elements:** send pill, edit, "what's an RTI?" info; escalation history in timeline. **States:** drafted (awaiting send), sent, escalating-level-up.
- **Motion:** breach banner slide-in; escalation card `reveal`; send success.
- **Data:** `issues/{id}/escalations` (§8.5); `POST /api/issues/[id]/escalations/[eid]/send`. **Done-when:** a breached issue shows an auto-drafted escalation (RTI/appeal/social by level) with one-tap send; level increments on repeated breach.

### C11 — Public impact dashboard  · (Learn · C11)
- **Route `/dashboard`** (public, full-width editorial; can use 60–96px display per `DESIGN.md`).
- **Layout:** `DarkFeatureBand` hero with the headline metric (**resolution rate**, count-up) + median time-to-resolve; a full-width **`MapView` heatmap** of issues (cluster + heat layers); `StatCard` grid (by group/ward/status, breached count); a "recently resolved" `BeforeAfter` strip.
- **Elements:** city/ward/category filters; time range; "report an issue" CTA → `/report`. **States:** loading skeleton; empty (seeded demo data avoids this).
- **Motion:** `StatCard` count-ups; heatmap fade-in; `reveal` sections.
- **Data:** `GET /api/stats`, `GET /api/issues/geo`. **Honesty:** lead with resolution rate + median time, never raw report counts. **Done-when:** heatmap renders clusters/heat; metrics match Firestore; filters work.

### C12 — Polish pass
- Motion pass (every async has skeleton; `prefers-reduced-motion` respected); all empty/error states filled; **PWA install prompt**; a11y (contrast AA, 44px tap targets, focus rings `focus-blue`, labels); responsive sweep (small-phone → desktop per `DESIGN.md` breakpoints); no layout shift. **Done-when:** Lighthouse a11y + PWA pass; no dead screens; smooth on a mid-range phone.

### C13 — [T2] Voice · multilingual · me-too · phone-OTP
- **Voice capture** UI (waveform, transcript preview) feeding Perceive; **full EN/हि i18n** via the toggle (strings + Cloud Translation); **"Me too" button** on issue detail (`mergeAmplify` count-up, one per user); **phone-OTP upgrade** sheet ("save your reports"). **Done-when:** each works without regressing CORE.

### C14 — Final polish + demo
- Seed-data visuals (an issue in every state for the dashboard + a breached + a verified one); landing/dashboard copy polish; the demo path renders cleanly end-to-end. **Done-when:** the full loop demos on the live URL with no rough edges.

---

## §E. Accessibility & responsive
- WCAG AA contrast (deep-green/near-black on white pass; coral/error used for state not body text); 44px min tap targets (Cohere pills already comply); visible focus rings (`focus-blue #4c6ee6`); semantic HTML + ARIA on the console (live-region for trace updates) and consent sheets; full keyboard path on the officer portal.
- Breakpoints per `DESIGN.md` §Responsive: citizen app single-column (<640), comfortable to 768; officer portal 2–3 col from 1024; dashboard scales display type up at ≥1440. Hero/console media stacks on mobile.

## §F. Asset checklist
App icons 192/512 (deep-green mark), maskable icon, favicon; `MapView` custom style JSON (muted canvas-matching); Lucide icon set (stroke 1.5); authority logo-marks (BBMP/BWSSB/BESCOM — monochrome, Cohere trust-strip style); Google-tech badges (Gemini/Maps/Firestore) for the console; OG image for the public dashboard.
```

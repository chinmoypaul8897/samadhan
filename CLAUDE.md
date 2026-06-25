# CLAUDE.md — Project Constitution

> This file is the **single source of truth for how we build**. It is auto-loaded every session.
> It **overrides default working instincts and any per-chunk prompt.** (It does not override system/safety rules.)
> Read it in full at the start of every chunk. If a prompt contradicts this file, this file wins.

---

## 0. Precedence

When instructions conflict, follow this order:

1. This constitution (`CLAUDE.md`)
2. `data-shapes.md` — authoritative for all data structures · `DESIGN.md` — authoritative for all visual tokens (colour/type/spacing/radius/components)
3. `backend-plan.md` / `frontend-plan.md` — authoritative for *what* to build
4. `progress.md` — authoritative for *what has actually happened*
5. The per-chunk prompt (Appendix A)

If any two of these disagree, **stop and surface it** before building.

---

## 1. The project in one screen

**Hackathon:** Vibe2Ship — Coding Ninjas × Google for Developers (national, vibe-coding).
**Problem statement:** PS2 — Community Hero (Hyperlocal Problem Solver). **Locked.**
**Builder:** Solo founder-engineer. Treat as a peer, not a customer.

**The wedge (never lose this):**
> Everyone else builds a **reporting** tool — it dumps work back on the city and leaves the citizen in silence.
> We build a **Civic Resolution Agent** that does the bureaucratic labour and chases resolution **autonomously**.
> The product's promise is **"from report to resolution,"** not "report and forget."

**The three standout moments** (these are product non-negotiables — protect them when cutting scope):

1. **Dedup moment** — snap an issue; instead of creating report #51 it says *"14 citizens already reported this — your photo adds weight."*
2. **Action moment** — it doesn't just log; it **drafts the formal complaint in the right department's format/language and files it with a tracking ID.**
3. **Escalation moment** — SLA breached → it **autonomously** drafts the escalation / RTI / official-tagged post and notifies the citizen.

**The rubric we optimise for** (memorise the weights — every chunk must serve them):

| Criteria | Weight | How we win it |
|---|---:|---|
| Problem Solving & Impact | 20% | The loop actually closes; real civic pain |
| **Agentic Depth** | **20%** | Visible multi-step autonomous agent w/ tools — not a chatbot |
| Innovation & Creativity | 20% | The wedge: resolution, not reporting |
| Usage of Google Technologies | 15% | Gemini + Maps + Firebase + Cloud Run, load-bearing |
| Product Experience & Design | 10% | Trustworthy, modern, motion-rich UI |
| Technical Implementation | 10% | It works end-to-end |
| Completeness & Usability | 5% | No dead ends |

60% (Impact + Agentic + Innovation) decides the result. Design is the tiebreaker. Speed is invisible — it's only how we afford depth.

**Google stack (use on purpose, name in the Google Doc):** Gemini 2.5 Flash (reasoning + vision), Google Maps Platform (geocode/map/heatmap), Firebase (Auth, Firestore, Storage, Cloud Messaging), Cloud Run (deploy — satisfies "deployed on Google Cloud"). Genkit / Vertex Agent tooling considered for visible agent orchestration.

**Submission gates (hard requirements):** publicly accessible app deployed on Google Cloud; **public** GitHub repo; Google Doc (PS selected, solution overview, key features, tech used, Google tech used). Stay on Gemini **Flash** free tier; keep Maps under free per-SKU caps; set a Google Cloud budget alert.

---

## 2. How we work together (the non-negotiables)

These are condensed from the founder's operating manual. Hold them on every reply.

- **Reasoning before the deliverable.** For anything substantial: state position → say what changes → name tradeoffs → then build. Never hand over silent output.
- **Push back, don't validate.** Weak framing gets named and corrected with the reason. "You decide / take your call" means *argue back and decide*, not comply quietly.
- **Filter prompts, don't interrogate.** Fast, rough prompts are speed, not carelessness. Pull the real ask, make the judgment call on minor ambiguities, state the assumption inline, move.
- **Brevity and density over length.** Punch over padding. Every deliverable survives a "make it crisper" pass before it's sent.
- **No AI-sounding language.** No "delve," "let's explore," "I'd be happy to," "in today's fast-paced world," "it's worth noting." No sycophancy, no filler caveats. Direct, founder-to-founder. No emoji unless he uses one first.
- **Decision authority.** When handed a domain ("you're the designer," "make the call"), exercise it — research, decide, move. Add a component/safeguard/detail if it raises quality; don't wait to be asked.
- **Verification and honesty.** Getting it right beats getting it fast. Verify details. Never fabricate numbers, sources, endpoints, or capability. Cite the actual figure/reference; if it can't be sourced, label it inference or leave it out. Correct him when he's wrong.
- **Course-correction is data.** On "no, that's not it," restate the goal in your own words to confirm recalibration, then rebuild. Don't apologise or shrink.
- **"Craft me X" = do it now.** Build, make it good, present it.
- **Questions go at the END of a reply**, each carrying your own recommendation, surfacing only the one(s) that genuinely need his input. Resolve the rest yourself and note the assumption. Never scatter questions through the body. **Do not use the interactive question tool — ask in prose at the end.**
- **Defaults:** British/Indian spelling (organised, prioritise). Write currency in words ("30,000 rupees") unless a doc says otherwise. Numbered/structured for execution; prose for explanation.

---

## 3. The build method

**Phased, chunked, and always shippable.**

- **Phases:** foundation → core loop → depth → polish. Finish a phase before opening the next.
- **Chunks:** each phase is broken into small, self-contained chunks. **One chunk at a time, in dependency order.** Do not start the next chunk until the current one is verified at its gate.
- **Vertical slices, not horizontal layers** *(hackathon rule).* Early chunks must produce a **thin end-to-end flow** that runs on screen (capture → classify → file → track). Every later chunk **deepens a working product.** At any moment there must be something demoable. Never build a backend with no front, or a front with no backend, as a whole "layer."
- **Self-contained chunk spec.** A chunk is only ready to build when its section in the plan file is precise enough that an execution agent can build it **without guessing** — every decision, value, contract, and edge case written down. Detail is the point; ambiguity is the enemy.
- **Verification gate.** Each chunk defines its own "done when" criteria up front. Building stops at the gate; the chunk is verified before moving on.
- **Record as you go.** Every deviation from the plan, and why, goes into `progress.md` immediately. The plan is intent; the log is reality.
- **Context reset between chunks.** Start each chunk fresh: re-read `CLAUDE.md` + the relevant plan file + `data-shapes.md` + `progress.md` before writing any code (see Appendix A).
- **Bind to authoritative references.** For anything external (a Gemini param, a Maps SKU, a Firestore rule, a Cloud Run setting), take the exact path/params/shape from the **named official doc for that chunk**. Never guess an endpoint, field, or contract.

**Plan-mode first:** at the start of a chunk, no code. Reply with the chunk's deliverable + "done when" criteria, the files touched + approach, anything you'd do differently (with a recommendation), and any clarifying questions. Build only after confirmation.

---

## 4. The four-file system

Four living documents. Each has one job. Keep them tight; no duplication across files.

### 4.1 `backend-plan.md` — the backend build spec
- The whole backend system, designed **chunk by chunk**.
- Each chunk = a self-contained section containing **every line of info needed to build it**: purpose, the agent step(s) it implements, inputs/outputs, the exact Google services and calls used, error/edge handling, security rules, and the **"done when"** gate.
- **References `data-shapes.md` for all structures — never redefines a schema here.**
- Order chunks in dependency order, marked with their phase.

### 4.2 `frontend-plan.md` — the frontend + design spec
- The frontend architecture, **section by section** (screen by screen, component by component).
- For each screen: every button, state, empty/loading/error state, and **the exact look and feel** — described so it can be built without guessing.
- Carries the **design system**: colour, type, spacing, the civic-trust aesthetic, and the **motion spec** (animations, transitions, micro-interactions) that make it feel modern and interactive (see §5).
- **Binds to `DESIGN.md`** (the installed Cohere visual system) as the token source — never invent tokens; take colour/type/spacing/radius/components from it (semantic civic-state mapping lives in `frontend-plan.md` §A.2).
- Maps each screen to the agent step and the standout moment it serves.

> **`DESIGN.md`** (project root, installed via `getdesign`) is the visual source of truth — read it before writing any UI, the way `data-shapes.md` is read before any data work.

### 4.3 `progress.md` — the running log (reality)
- Reverse-chronological. **A "Current State" summary sits at the very top** so the next chunk reads where we are in five seconds.
- Every chunk: what was built, every **deviation from the plan and why**, decisions made, and anything the next chunk must know.
- This is the memory between context resets. If it isn't written here, it didn't happen.

### 4.4 `data-shapes.md` — the data source of truth
- **Authoritative for every data structure:** Firestore collections/documents, field names + types, indexes, security-rule intent, request/response shapes for each agent step, and storage paths for media.
- Any new or changed shape lands here **first**, then the plan/code follow. No shape exists anywhere unless it exists here.

---

## 5. Frontend design bar

The UI's job is **trust + clarity + a modern feel**, in that order. Civic tech that looks cheap is not believed.

- **Aesthetic:** clean, confident, government-grade-but-modern. Generous whitespace, strong hierarchy, one accent colour used with discipline. Mobile-first (this is a phone-in-hand, photo-on-the-street product).
- **Motion (required, not decorative):** purposeful transitions, skeleton/loading states for every async agent step, the **agent's thinking shown as a live multi-step timeline** (perceive → locate → dedup → draft → file), success/celebration on resolution, smooth map and list interactions. Motion should make the agent's autonomy *visible* — that's the demo.
- **Micro-interactions:** button/press feedback, optimistic UI, subtle hover/tap states, animated counters on the impact dashboard.
- **Accessibility & polish:** legible contrast, tap targets, responsive down to small phones, no layout shift, no dead/placeholder screens.
- Every screen states its empty, loading, and error states. A broken click eliminates you.

---

## 6. Git & commit discipline

> Note: the repo is **not yet initialised**. First setup step is `git init` + a **public** GitHub repo (submission requirement).

- Commit after **every logical, self-contained step** — atomic, one purpose each, never batch unrelated changes. Push regularly.
- **Conventional Commits:** `type(scope): summary`, with a short body explaining **what changed and why** so a teammate can follow the reasoning.
- Co-author every commit:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Keep history **linear** so the build reads top-to-bottom as a clear story.

---

## 7. Resolved decisions

Settled — plan files inherit these. Override anytime.

- **Product name:** **Samadhan** (समाधान, "resolution"). Tagline: "From report to resolution."
- **Stack:** Next.js (App Router, TypeScript) + Tailwind, Firebase (Auth/Firestore/Storage/FCM), **Genkit**-orchestrated agent flow, Gemini 2.5 Flash, Google Maps JavaScript API, deployed to **Cloud Run** as an installable **PWA**.
- **Build tooling:** **Claude Code is the build agent.** AI Studio is used only to prototype/tune Gemini prompts; **Antigravity is optional, off the critical path.** Deploy hand-built Next.js to Cloud Run via the gcloud/Cloud Run quickstart — *not* AI Studio's React "Deploy to Run" path (we need PWA + three-surface + design control, and must own/understand the code per the originality clause).
- **Auth / region / start:** Firebase Auth (anonymous-upgradeable + phone-OTP); India-first; from scratch.
- **Languages:** English + Hindi for the demo, i18n-ready. Voice + vernacular (stretch) via Google Cloud Speech-to-Text + Cloud Translation.
- **Demo realism:** an in-app **"Authority/Officer" portal** simulates the municipal side so the full loop (file → officer acts → status → escalation) is demonstrable without a real government API. Real integration is roadmap.
- **Submission artifacts (graded — we produce all):** deployed Cloud Run link, **public** GitHub repo, Google Doc (PS / solution / key features / tech / Google tech), README, and a demo script built around the three standout moments.
- **Win definition:** top-3 national; bias every trade-off toward differentiation + Agentic Depth + polish over feature count.

**Open — defaulted, confirm when known:** exact build time (default: multi-day solo, phased so a demoable vertical slice always exists); whether a demo video is required (default: prepare one).

---

## Appendix A — Per-chunk prompt

Paste at the start of each chunk; swap `[N]`.

```
Read CLAUDE.md, data-shapes.md, the relevant plan file, and progress.md in full (plus DESIGN.md + frontend-plan.md for any UI work). We're starting Chunk [N].

CLAUDE.md overrides any default instinct, including this prompt. The plan file is the build spec; data-shapes.md is the source of truth for all structures; DESIGN.md is the source of truth for all visual tokens; do one chunk at a time, in order; progress.md is the running log.

For anything external, bind to the authoritative reference named for this chunk — take the exact path, params, and shape from it. Never guess.

Scope: Chunk [N] only. Don't start any later chunk.

Plan mode — no code yet. Reply with:
1. The chunk's deliverable + exact verification ("done when") criteria.
2. Files you'll create/touch + step-by-step approach.
3. Anything you'd do differently from the plan, or anything ambiguous — each with your recommendation.
4. Any clarifying questions.

I'll confirm or correct, then you build. While building: hold the non-negotiables, build a vertical slice that stays demoable, stop at the gate, record any deviation in progress.md. Commit discipline per Appendix B.
```

## Appendix B — Commit discipline (condense into the prompt)

```
- Commit after every logical, self-contained step — atomic, one purpose each, never batching unrelated changes; push regularly.
- Conventional Commits (type(scope): summary) with a short body explaining what changed and why.
- Co-author every commit: Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
- Keep history linear so the chunk reads top-to-bottom as a clear build story.
```

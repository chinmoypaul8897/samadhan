# Samadhan — समाधान

**An AI Civic Resolution Agent. Not a reporting app — a resolution-and-verification layer.**

> **From report to resolution.** A citizen snaps a civic issue; an autonomous multi-step agent perceives it, locates it, de-duplicates it against nearby reports, routes it to the correct authority, drafts and files the formal complaint, tracks the real SLA, escalates on breach, and verifies the fix with before/after vision + citizen confirmation before anything is called "resolved."

**Live:** https://samadhan-554128679437.asia-south1.run.app · **PWA** (installable) · Built for **Vibe2Ship** (Coding Ninjas × Google for Developers), Problem Statement 2 — *Community Hero (Hyperlocal Problem Solver)*.

---

## The wedge

Everyone else builds a **reporting** tool — it logs a complaint, dumps the work back on the city, and leaves the citizen in silence. Samadhan does the bureaucratic labour and chases resolution **autonomously**. The product's promise is *from report to resolution*, not *report and forget*.

### Three standout moments
1. **Dedup** — snap an issue already reported; instead of creating report #51 the agent says *"14 citizens already reported this — your photo adds weight,"* and links you to the live issue.
2. **Action** — the agent doesn't just log it: it **drafts the formal complaint** in the right department's format and language, and files it under a tracking ID, on one tap.
3. **Escalation** — when the SLA is breached, the agent **autonomously drafts the escalation** (reminder → higher-authority appeal → RTI application), notifies the citizen, and offers a one-tap send.

And the part that makes "resolved" honest: **before/after verification.** When the authority marks an issue fixed, the agent runs an independent Gemini vision check on the before vs after photo, and the status only becomes *verified resolved* when the **citizen confirms** — AI never auto-closes.

---

## The agent (Agentic Depth)

The intake pipeline is a visible, multi-step Genkit flow over Gemini 2.5 Flash — each step renders live in a dark "agent console" as the server writes it:

```
Capture → Perceive → Locate → Dedup → Route → Act        (intake, per report)
              │         │        │       │      │
        Gemini vision   Maps    Gemini  rules  Gemini draft
        classify +    reverse   multi-  first  formal complaint
        severity +    geocode   image   route  (right dept/lang)
        OCR + lang              compare
                                                 ↓
        Track → (officer acts) → Verify → Escalate → Learn   (issue lifecycle)
          │                        │          │         │
         SLA + FCM push       Gemini      Scheduler   public
         + timeline           before/     sweep →     stats +
                              after        autonomous  heatmap
                              verdict      RTI draft
```

It's a real agent with tools (vision, geocoding, Firestore transactions, FCM, a scheduler), not a chatbot. Every step is traced; the autonomy is the demo.

---

## Google technologies (load-bearing)

| Technology | How it's used |
|---|---|
| **Gemini 2.5 Flash** (Vertex AI, via Genkit) | The agent's brain — vision classification + severity + OCR + language detection (Perceive), multi-image same-issue comparison (Dedup), formal-complaint drafting (Act), before/after resolution verdict (Verify), escalation/RTI drafting (Escalate), and voice-note transcription. ADC, no API key. |
| **Google Maps Platform** | Server-side reverse geocoding (address + ward) on every report; the public dashboard's severity-weighted hotspot map; manual map-pin fallback when GPS is denied. |
| **Firebase** | Auth (anonymous; phone-OTP upgrade built but disabled pending a reCAPTCHA Enterprise key), Firestore (the whole data model + live `onSnapshot` trace), Storage (citizen photos + before/after proof), Cloud Messaging (status push). |
| **Cloud Run** | Hosts the Next.js app (standalone container, `asia-south1`). Satisfies "deployed on Google Cloud." |
| **Cloud Scheduler** | Triggers the autonomous SLA-breach sweep (escalation drafting + stale-resolution auto-verify). |
| **Open311 GeoReport v2** | The issue model is mapped to the civic-interoperability standard and exported at `/api/open311/requests`. |

---

## Key features

- **One-tap capture** → photo + auto-GPS (+ optional voice note, transcribed by Gemini).
- **Live agent trace** — the pipeline animates step-by-step with per-step latency and Google-tech badges.
- **Dedup & amplify** — nearby same-category reports merge into one issue with a rising supporter count.
- **Correct-authority routing** — pothole → BBMP, water leak → BWSSB, power outage → BESCOM, with the formal complaint drafted in the right format/language.
- **Real SLA clock** — sourced from municipal citizen-charter timeframes, with on-track / due-soon / breached states.
- **Autonomous escalation** — reminder → appeal → RTI, drafted on breach with one-tap send.
- **Honest verification** — Gemini before/after verdict + mandatory citizen confirm; "me too" support; reopen on a bad fix.
- **Officer portal** — a simulated municipal side: support-sorted queue, acknowledge → assign → start → resolve (proof photo required) → cannot-fix.
- **Public impact dashboard** — resolution rate + median time-to-resolve (never vanity report counts) over a city hotspot map.
- **Installable PWA**, mobile-first, motion-rich, accessible.

---

## Tech stack

- **Next.js** (App Router, TypeScript, Turbopack, standalone output) + **Tailwind v4** — installable PWA on **Cloud Run**.
- **Firebase** (client SDK + `firebase-admin`, ADC) — Auth, Firestore, Storage, Cloud Messaging.
- **Genkit** + **`@genkit-ai/google-genai`** orchestrating **Gemini 2.5 Flash** on Vertex AI.
- **Google Maps Platform** — Geocoding (server) + Maps JavaScript (client heatmap).
- Data modelled on **Open311 GeoReport v2**.

## Repository layout

```
/                     planning + spec docs (the source of truth)
  CLAUDE.md           how we build (the constitution)
  what-to-build.md    what + why
  data-shapes.md      data source of truth (Firestore + agent I/O + Open311 mapping)
  DESIGN.md           visual source of truth (Cohere design system)
  backend-plan.md     backend build spec (chunk by chunk)
  frontend-plan.md    frontend build spec (chunk by chunk)
  progress.md         running build log (reality)
  SUBMISSION.md       the submission write-up
/samadhan             the Next.js application
  src/genkit/         the agent: flow + steps (perceive/locate/dedup/route/act/verify/escalate)
  src/app/api/        server endpoints (intake, officer, stats, geo, open311, sla-sweep, …)
  scripts/            seed (reference data) + seed-demo (canonical demo dataset)
/docs                 runbooks
```

## Develop (local)

```bash
cd samadhan
npm install
npm run dev          # http://localhost:3030

# server-side Google calls (Gemini via Vertex, Admin SDK) use ADC:
gcloud auth application-default login

# seed reference data (catalogue + authorities + officers):
node scripts/seed.mjs
# seed the canonical demo dataset (lights up /dashboard):
node scripts/seed-demo.mjs            # idempotent; --cleanup removes it
```

Public config lives in `.env.local` (`NEXT_PUBLIC_*`, gitignored); secrets are in Secret Manager (server only). The build is a multi-stage `node:22-slim` Docker image deployed via Cloud Build → Cloud Run.

## Open311 export

```
GET /api/open311/requests              GeoReport v2 service_requests (JSON array)
GET /api/open311/requests?format=xml   GeoReport v2 XML
GET /api/open311/requests?status=open|closed&service_code=<code>
```

## Roadmap

Deliberately out of scope for this build, in priority order:

- **Watch your ward** — follow a neighbourhood and get notified of every new issue and resolution in it (SeeClickFix-style area subscription).
- **Two-way officer ↔ citizen messages** on an issue (clarifying questions, replies) on top of the current one-way timeline.
- **Pre-submission nearby-issue nudge** — surface existing nearby issues on the capture map before you report (complements the current post-capture AI dedup).
- **Phone-OTP sign-in** — built and dormant; needs a provisioned reCAPTCHA Enterprise web key to re-enable.
- **Full UI internationalisation** — the interface is English today; the *complaint* is already filed in the citizen's own language (auto-detected). Vernacular UI strings are next.
- **WhatsApp intake** and **video reporting** — additional capture channels (need a WhatsApp Business number / video pipeline).
- **Real government-portal integration** — the officer side is simulated today (no public write-API exists); a real Open311 endpoint integration is the path.
- **Predictive analytics** — true forecasting of hotspots/recurrence (beyond the current descriptive insights), once there is real usage data.

## Status

Shipped end-to-end. See `progress.md` for the full build log and `SUBMISSION.md` for the submission write-up.

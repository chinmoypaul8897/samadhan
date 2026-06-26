# Samadhan — Submission

> Paste this into the submission Google Doc. Set sharing to **"Anyone with the link → Viewer."**

**Samadhan (समाधान, "resolution") — an AI Civic Resolution Agent.**
*From report to resolution, not report and forget.*

- **Live app:** https://samadhan-554128679437.asia-south1.run.app
- **Repository (public):** https://github.com/chinmoypaul8897/samadhan
- **Hackathon:** Vibe2Ship — Coding Ninjas × Google for Developers
- **Builder:** solo founder-engineer

---

## 1. Problem statement selected

**PS2 — Community Hero (Hyperlocal Problem Solver).**

Indian cities run on civic complaints — potholes, garbage, broken streetlights, water leaks, sewer overflows, power cuts. Citizens already have apps to *report* these. The problem isn't reporting; it's that **reporting changes nothing**. The complaint is logged, the work is dumped back on an overloaded municipal body, and the citizen is left in silence with no tracking, no accountability, and no resolution. Reports pile up as duplicates; SLAs lapse unnoticed; "resolved" is whatever the department says it is.

## 2. Solution overview

Samadhan is **not another reporting tool — it is a resolution-and-verification layer** that does the bureaucratic labour for the citizen and chases the fix autonomously.

A citizen snaps a photo. From there an **autonomous, multi-step AI agent** takes over:

1. **Perceive** — Gemini vision classifies the issue, grades severity, reads any signage (OCR), and detects the language.
2. **Locate** — Google Maps reverse-geocodes the GPS into an address and ward.
3. **Dedup** — the agent searches nearby reports and, using multi-image comparison, decides whether this is a new issue or the 51st report of an existing one. If it exists: *"14 citizens already reported this — your photo adds weight."*
4. **Route** — it picks the correct authority (municipal corporation / water board / DISCOM) and department by rules.
5. **Act** — it **drafts the formal complaint** in the right format and language, and files it under a tracking ID on one tap.
6. **Track** — it starts the real SLA clock (from municipal citizen-charter timeframes) and pushes every status change.
7. **Escalate** — when the SLA is breached, it **autonomously drafts the escalation** — a reminder, then a higher-authority appeal, then a full **RTI application** — and offers the citizen a one-tap send.
8. **Verify** — when the authority uploads a proof-of-fix photo, Gemini runs an independent before/after verdict. The issue becomes *verified resolved* **only when the citizen confirms** — AI never auto-closes.

The loop actually closes, and "resolved" means something.

### Why this is different from what already exists

Bengaluru is not short of *reporting* tools. Janaagraha's **I Change My City** has run since 2012 and routes complaints to the very same bodies (BBMP, BWSSB, BESCOM); the government's own **Sahaaya / Namma Bengaluru** app covers 20+ departments. Yet roughly a third of reported issues still never resolve — because these are **reporting and routing portals**: they forward the complaint and leave the citizen to chase it, with no help when the deadline lapses. Global platforms (FixMyStreet, SeeClickFix) and standalone AI-RTI tools exist too, but none of them close the loop.

**Samadhan is the resolution-and-accountability layer those tools are missing.** It doesn't just forward a complaint — an autonomous agent *drafts* it, *files* it, and when the SLA is breached it **autonomously escalates to an RTI** without the citizen lifting a finger; then it **independently verifies** the fix with before/after vision and the citizen's confirmation, instead of trusting the authority's "resolved" flag. We don't compete with the reporting apps — we add the layer that turns a report into a resolution. The dataset is exported in the **Open311** standard, so it interoperates with that existing ecosystem rather than replacing it.

## 3. Key features

- **Frictionless capture** — one tap: photo + auto-GPS, optional voice note (transcribed by Gemini), near-zero typing. Manual map-pin fallback when GPS is denied.
- **Live agent console** — the pipeline animates step-by-step with per-step latency and Google-tech badges, so the agent's autonomy is *visible* (this is the core of Agentic Depth).
- **Dedup & amplify** — duplicate reports merge into a single issue with a rising supporter count and a "me too" tap.
- **Correct-authority routing + drafted complaint** — pothole → BBMP, water leak → BWSSB, power outage → BESCOM, each with a formal complaint drafted in the right department format, **in the citizen's own language** — auto-detected from their voice or text (English, Kannada and other Indian languages), so non-English speakers aren't shut out of civic redress.
- **Real SLA tracking** — on-track / due-soon / breached states sourced from citizen-charter timeframes, with push notifications.
- **Autonomous escalation** — reminder → appeal → RTI, drafted on breach by a Cloud Scheduler sweep, with one-tap send.
- **Honest verification** — Gemini before/after verdict + mandatory citizen confirmation; reopen on a bad fix.
- **Officer / authority portal** — a simulated municipal side: a support-sorted queue and the full action ladder (acknowledge → assign → start → resolve with a required proof photo → cannot-fix).
- **Public impact dashboard** — leads with resolution rate and median time-to-resolve (never vanity report counts) over a city hotspot map.
- **Open311 interoperability** — the issue dataset is exported in the Open311 GeoReport v2 standard.
- **Installable PWA** — mobile-first, motion-rich, accessible, deployed on Google Cloud.

## 4. Technologies used

- **Next.js** (App Router, TypeScript, Turbopack, standalone) + **Tailwind CSS** — an installable PWA.
- **Genkit** + `@genkit-ai/google-genai` — orchestrates the multi-step agent flow and traces every step.
- **Firebase** — Authentication, Cloud Firestore, Cloud Storage, Cloud Messaging.
- **TypeScript / Node 22**, deployed as a container on **Cloud Run** via **Cloud Build**.
- Data modelled on the **Open311 GeoReport v2** civic standard.

## 5. Google technologies used (load-bearing)

- **Gemini 2.5 Flash** (on **Vertex AI**, via Genkit) — the agent's reasoning + vision: classification, severity, OCR and language detection (Perceive); multi-image same-issue comparison (Dedup); formal-complaint drafting (Act); before/after resolution verdict (Verify); escalation and RTI drafting (Escalate); and voice-note transcription. Runs on application-default credentials, no API key, on the Gemini Flash free tier.
- **Google Maps Platform** — server-side Geocoding (reverse-geocode every report into address + ward) and Maps JavaScript (the public dashboard's severity-weighted hotspot map; manual map-pin fallback).
- **Firebase** — Auth (anonymous, **upgradeable to phone-OTP** — a citizen links their number to keep their reports across devices; reCAPTCHA-protected), Firestore (the full data model with live `onSnapshot` for the agent trace and timelines), Storage (citizen photos + before/after proof), Cloud Messaging (status push).
- **Cloud Run** — hosts the app in `asia-south1`; the "deployed on Google Cloud" requirement.
- **Cloud Scheduler** — triggers the autonomous SLA-breach sweep (escalation drafting + stale-resolution auto-verify).
- **Cloud Build + Artifact Registry + Secret Manager** — the build/deploy/secrets pipeline.

## 6. What's real vs simulated (honesty)

Everything in the loop is real software: the agent, the Gemini calls, the geocoding, the Firestore data model, the SLA engine, the escalation drafting, the verification, the push notifications, and the Open311 export. The **municipal/officer side is simulated in-app** (there is no public government write-API to file into), so the full loop — file → officer acts → status → verify → escalate — is demonstrable end-to-end. Real government-portal integration is the roadmap. No fabricated official identities, logos, or numbers are used anywhere; authority data carries only verifiable public facts.

## 7. Submission checklist

- [x] Publicly accessible app deployed on Google Cloud (Cloud Run URL above)
- [x] Public GitHub repository (link above)
- [x] This document (PS selected · solution · key features · tech used · Google tech used)
- [x] README + demo script in the repository

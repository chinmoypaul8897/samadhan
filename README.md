# Samadhan — समाधान

**An AI Civic Resolution Agent. Not a reporting app — a resolution-and-verification layer.**

> From report to resolution. A citizen snaps a civic issue; an autonomous multi-step agent perceives, locates, de-duplicates, routes to the correct authority, drafts and files the complaint, tracks the real SLA, escalates on breach, and verifies the fix with before/after vision + citizen confirmation before anything is called "resolved."

Built for **Vibe2Ship** (Coding Ninjas × Google for Developers), Problem Statement 2 — Community Hero.

## Tech
- **Next.js** (App Router, TypeScript) PWA on **Cloud Run**
- **Firebase** — Auth, Firestore, Storage, Cloud Messaging
- **Genkit** + **Gemini 2.5 Flash** — the agent (vision + reasoning, structured output)
- **Google Maps Platform** — geocoding, map, clustering, heatmap
- Data modelled on the **Open311 GeoReport v2** standard

## Repository layout
```
/                     planning + spec docs (the source of truth)
  CLAUDE.md           how we build (constitution)
  what-to-build.md    what + why
  data-shapes.md      data source of truth
  DESIGN.md           visual source of truth (Cohere design system)
  backend-plan.md     backend build spec (chunk by chunk)
  frontend-plan.md    frontend build spec (chunk by chunk)
  progress.md         running build log
/samadhan             the Next.js application
/docs                 runbooks (cloud bring-up, etc.)
```

## Develop (local)
```bash
cd samadhan
npm install
npm run dev          # http://localhost:3000
```

## Status
Foundation phase — Chunk 0. See `progress.md`.

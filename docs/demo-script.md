# Samadhan — Demo Script

A ~5-minute run-of-show built around the three standout moments. Live app:
**https://samadhan-554128679437.asia-south1.run.app**

> One-line pitch to open with: *"Everyone else built a way to **report** civic issues. Samadhan is an autonomous agent that gets them **resolved** — it dedupes, files the formal complaint, tracks the SLA, escalates on breach, and verifies the fix. From report to resolution."*

**Before you start:** open on a phone (or a narrow browser window — it's a mobile-first PWA). The canonical demo dataset is already seeded, so every screen is populated. Officer login credentials are in `samadhan/scripts/seed-output.local.json` (gitignored); the BBMP officer is `officer.bbmp@samadhan.local`.

---

## 0 · The impact dashboard (15s) — set the frame
Open **`/dashboard`**. Let the headline count up: **resolution rate + median time-to-resolve** over a Bengaluru hotspot map, with a strip of real **before/after** fixes. *"This is the public scoreboard — honest metrics, not vanity report counts. Here's how an issue gets here."*

## 1 · Capture → the live agent (45s) — Agentic Depth
Tap **Report**, snap (or pick) a photo of a pothole. Watch the **dark agent console** animate:
**Perceive** (Gemini: "Pothole · high severity") → **Locate** (Maps: ward) → **Dedup** → **Route** (BBMP · Roads) → **Act**.
*"That's a real multi-step agent with tools — vision, geocoding, a database transaction — not a chatbot. Each step is traced with its latency."*

## 2 · Standout #2 — Action (30s)
On the resulting issue, the **Act** step has drafted the **formal complaint to BBMP** in the right format. Open the file sheet:
*"It didn't just log a pothole — it wrote the complaint to the Roads department and started the 24-hour SLA clock. One tap to file."* Tap **File**.

## 3 · Standout #1 — Dedup (45s)
Snap the **same** issue again (same spot). The console's **Dedup** step lights up and the screen shows the merge:
*"14 citizens already reported this — your photo adds weight."* The supporter count animates up.
*"The 51st report doesn't become noise — it becomes pressure on one issue."*
> Fallback if location won't match live: use **"Set location manually"** to drop the pin near an existing active issue (e.g. the acknowledged pothole in Malleshwaram), or just point to a seeded issue's high supporter count on the dashboard.

## 4 · The officer side (40s) — the loop is real
Open **`/officer`**, log in as the BBMP officer. The queue is **sorted by supporter count** — the lever that drives action. Open an issue → **Acknowledge → Start → Resolve**, uploading a proof-of-fix photo.
*"The municipal side is simulated in-app so the whole loop is demonstrable — there's no public government write-API to file into."*

## 5 · Standout #3 — Verify (40s)
Back on the citizen issue (now *resolved, pending verification*): the agent shows a **before/after** pair and its **Gemini verdict** ("looks resolved · same location"). Tap **"Yes, it's fixed"** → the **green resolve bloom**.
*"'Resolved' isn't whatever the department says. The agent checks the proof, and only the citizen's confirmation closes it. AI never auto-closes."*
> Variant: show the mismatch path — a wrong "after" photo → *"the resolved photo doesn't match this location — reopening."*

## 6 · Autonomy — Escalation (40s)
Open the breached sewer-overflow issue (tracking **SMD-65K9Q86R**, Shivajinagar). Show the **breach banner** and the agent's **auto-drafted escalation** (reminder → appeal → RTI). *"When the deadline lapses, nobody has to chase it — the agent drafts the RTI application itself and hands the citizen a one-tap send."*
> To show it happening live, trigger the sweep: `gcloud scheduler jobs run sla-sweep --location asia-south1` (if the cron is created), or call `/api/internal/sla-sweep` with the `X-Sweep-Token`.

## 7 · Close (15s) — interoperability
*"And it's standards-based —"* open **`/api/open311/requests`**: the whole dataset in **Open311 GeoReport v2** (`?format=xml` for XML). End back on `/dashboard`. *"From report to resolution."*

---

## Seeded reference issues (for the populated screens)
| Tracking ID | Issue | State | Use for |
|---|---|---|---|
| SMD-YY4CE7SW | Pothole · Koramangala (14 supporters) | verified_resolved | dashboard before/after + the "N citizens" number |
| SMD-65K9Q86R | Sewer overflow · Shivajinagar (hazard) | in_progress · **breached + escalated** | the escalation beat |
| SMD-CT65DT1S | Water leak · Hebbal | resolved_pending_verification | the verify state |
| SMD-CWRTEAH5 | Pothole · Malleshwaram | acknowledged (active) | a live dedup target |
| SMD-3G2005BT | Sewer overflow · Indiranagar | submitted · breached | breach count |

## If something is slow
- The first request after idle may cold-start (the demo deploy runs **min-instances 1**, so this should be warm). If a Gemini step is slow, narrate the trace — the latency *is* the agent working.
- Re-seed any time: `node scripts/seed-demo.mjs` (idempotent). Remove with `--cleanup`.

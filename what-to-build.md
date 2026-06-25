# what-to-build.md — The Product We Are Building

> The overview document. It states exactly what we build and why each choice beat the alternatives. It is grounded in six research streams (existing platforms, failure modes, AI feasibility, India resolution mechanics, engagement science, open-source + Google stack). Sources are listed at the end. The detailed *how* lives in `backend-plan.md`, `frontend-plan.md`, and `data-shapes.md`.

---

## 1. The answer first

**We are building Samadhan** *(working name — समाधान, "resolution"; overridable)* — **an AI Civic Resolution Agent. Not a reporting app. A resolution-and-verification layer.**

> **Everyone built the report button. We build the agent that makes sure it actually got fixed — and proves it.**

A citizen reports a civic issue in seconds (photo + auto-location + optional voice). An autonomous multi-step agent then **perceives, locates, de-duplicates, routes to the correct authority, drafts and prepares the formal complaint, tracks it against the real published SLA, escalates on its own when the deadline is breached, and — the part nobody else does — verifies the fix with before/after vision and citizen confirmation before anything is allowed to be called "resolved."**

Tagline: **"From report to resolution."**

---

## 2. Why this, and why it beats the alternatives

The problem statement lists report / categorise / map / verify / track / resolve. Most teams will build the first three well and stop. The research says that is exactly the wrong half.

**Finding 1 — the market gap is resolution, not reporting.** Mapping eleven platforms (FixMyStreet, SeeClickFix, Snap Send Solve, US 311, Swachhata, CPGRAMS, I Change My City, Solve Ninja, Indian municipal apps) against nine capabilities, **not one genuinely closes the loop to a verified fix.** They are forwarders, routers, or status-flaggers. "Closed" is a workflow state, not a guarantee of repair. The reporting space is the 451st-app bloodbath; the resolution space is empty.

**Finding 2 — closing the loop is the strongest retention lever in the field.** A responded-to first report is associated with a **57% increase in the probability of a second report** (Sjoberg, Mellon & Peixoto, *Public Administration Review*, n = 399,364 FixMyStreet reports). Government *outcome-feedback* — not badges, not public praise — is the active ingredient that sustains participation (Buntaine et al., two Uganda field experiments). Build the loop or the product dies; this is empirical, not opinion.

**Finding 3 — "closed ≠ fixed" is the universal, quantified, *admitted* pain.** NYC Council's own data: of 2018 responses only **21.5% were actually "Fixed."** A San Antonio 311 director on record: *"'closed' does not mean 'resolved.'"* Pune issued a formal directive ordering staff to stop closing complaints without citizen feedback. Swachhata reviews document complaints marked "resolved" with unrelated photos from other locations. Andhra Pradesh revenue grievances: **85% officially disposed, 53% citizen satisfaction.** An agent that independently verifies closure attacks the single biggest failure mode head-on.

**Finding 4 — the tech aligns perfectly with the gap.** Gemini 2.5 Flash is genuinely strong (zero training) at multimodal classification, severity triage, structured extraction, and **visual before/after judgment** (research F1 0.88 for civic classification; MLLM-as-judge strongest in pair comparison). It is weak at precise object detection and depth estimation (state-of-the-art road-damage detection tops out ~0.76 F1 even with fine-tuned models; garbage-in-the-wild ~16% mAP). **So the feature nobody has (verified resolution) is the one our tooling does best, and the feature everyone attempts (precise detection) is the one we are right to avoid.** This is a rare strategic alignment — lean into it.

**Conclusion.** The wedge is **verified resolution + autonomous escalation**, with reporting reduced to a frictionless on-ramp. This wins on the three rubric pillars that decide the result (Impact, Agentic Depth, Innovation — 60%), maximises Google-tech (15%), and is defensible because it is the one axis the entire global and Indian field fails on.

---

## 3. The agent pipeline (this *is* the product, and the Agentic Depth score)

A single autonomous flow, with the human kept in the loop only at legal/payment gates. Built as a **Genkit flow** so the step-by-step agent trace is visible — which is both the demo centrepiece and the literal evidence of "Agentic Depth."

| # | Step | What the agent does | Powered by |
|---|---|---|---|
| 1 | **Capture** | Citizen sends photo + auto-GPS + optional voice note. Minimal typing. | PWA camera/geolocation, Firebase Storage |
| 2 | **Perceive** | Classify category, sub-category, **coarse severity (low/med/high)**, caption, OCR any visible sign/landmark; validate "is this a real civic issue?" — one structured call. | Gemini 2.5 Flash (vision → JSON) |
| 3 | **Locate** | Reverse-geocode to address + ward/zone; identify jurisdiction. | Maps Geocoding |
| 4 | **De-duplicate & amplify** | Geospatial gate (geohash radius + category) → Gemini "same issue?" confirm → **merge into one thread showing "N citizens reported this."** Never silently close. | Firestore geo-query + Gemini |
| 5 | **Route** | Map to the *correct* body — pothole/garbage/streetlight → **Municipal Corporation**; water/sewage → **Water Board**; power → **DISCOM** — and the right channel. | Rules + Gemini |
| 6 | **Act** | Draft the formal complaint in the correct format and language; produce a tracking reference. **Human gives one-tap consent** at the submit/payment gate. | Gemini structured output |
| 7 | **Track** | Start a countdown from the **real published SLA**; status lifecycle; push/notify on every change. | Firestore + FCM |
| 8 | **Escalate (autonomous)** | On SLA breach: draft an RTI request / higher-authority appeal / a ready-to-post social escalation tagging the correct official. **One-tap to send.** | Gemini + rules |
| 9 | **Verify (the differentiator)** | On "resolved": Gemini compares before/after photos + checks GPS/timestamp match + asks the citizen to confirm. **"Resolved" is final only on citizen confirmation** (or auto-confirm after a grace window, easily re-opened). | Gemini vision + metadata |
| 10 | **Learn** | Cluster reports into a hotspot heatmap; surface honest metrics (resolution rate, median time) to citizens and authorities. | Clustering + Maps heatmap |

**The three standout moments** (protect these when cutting scope):
1. **Dedup** — *"14 citizens already reported this — your photo adds weight."*
2. **Action** — *"I've drafted the formal complaint to the Roads dept. and started the 24-hour SLA clock. Tap to file."*
3. **Verify** — *"The 'resolved' photo doesn't match this location. Re-opening and escalating."* ← no competitor can do this.

---

## 4. Exact feature set — what we build, what we cut, and why

### CORE — must build (the demo spine)

| Feature | Why this was chosen (evidence) |
|---|---|
| **Frictionless capture**: photo + auto-GPS + optional voice, anonymous-upgradeable login, near-zero typing | Reporting friction kills adoption; low-literacy users complete 0% on text vs 72% on voice (Medhi et al.). The on-ramp must be trivial. |
| **Agentic intake** — one Gemini call → Open311-shaped JSON (category, dept, severity, caption, OCR, title) | Gemini's highest-confidence zero-training capability (civic classification F1 0.88, Amsterdam). This is the agentic anchor and needs no model training. |
| **Dedup → merge & amplify** ("N citizens reported this"), surfaced to authorities | NYC's dedup catastrophe (closing one "primary" closed 175 linked complaints) shows silent-close is fatal; engagement signals roughly *double* closure and work *because staff see the count* (Schiff, SeeClickFix). Turn volume into a severity signal, never noise to suppress. |
| **Right-authority routing + complaint drafting + prepared filing** | Real citizen pain: "who do I even complain to?" Water/power are usually *not* the municipality. Routing is genuine, demonstrable intelligence needing zero integration. |
| **SLA clock + status lifecycle + loop closure** (push on change; before/after photo on resolve) | The +57% finding — closing the loop is the #1 retention lever. A live "X hours to SLA breach" timer is the spine of escalation. |
| **AI-verified resolution** — before/after + GPS/timestamp + citizen confirm; "resolved" requires confirmation | The core differentiator. Attacks false-closure (the universal admitted pain) using Gemini's genuine strength (pair-comparison vision). Hardest feature to copy. |
| **Autonomous escalation on breach** — RTI draft / appeal / one-tap social post | The gap nobody fills; makes autonomy visible (Agentic Depth). RTI has no mandated format and a known template, so it is genuinely buildable. |
| **Authority / Officer portal** (simulated municipal side), queue sorted by support count | We cannot make a real official act during a hackathon; this makes the full loop demonstrable end-to-end and lets us show the count-to-staff mechanism that drives resolution. |
| **Impact dashboard + hotspot heatmap** (clustering, honest metrics) | Memphis + Google Cloud found 75% more potholes via data (only 20% were resident-reported). Clustering gives "predictive" value honestly, without training a forecaster. Show resolution rate + median time, never vanity counts. |

### SECONDARY — build if time allows

- **WhatsApp reporting channel** (853M Indian users; municipalities already run WhatsApp complaint lines) — highest impact-for-effort distribution play; in-app capture covers the demo if time is short.
- **Multilingual + voice** (English + Hindi for the demo, i18n-ready; vernacular is a participation gate — ~70% struggle with English keyboards). Implement via **Google Cloud Speech-to-Text** (voice reporting) + **Cloud Translation** (vernacular) — high equity impact and it banks additional Google-tech points.
- **Phone-OTP identity anchor + reactive moderation** (one number = one identity; reports go live, flag-to-hide) — cheap Sybil/abuse defence that keeps the system open (FixMyStreet runs on ~15 min–1 hr/day of reactive moderation).
- **Low-threshold "me too" confirm** — a few confirmations capture most validation benefit (accuracy plateaus by ~13 contributors); pair counts with positive framing to avoid the boomerang effect.

### OUT — explicitly not building, and why

| Cut | Reason |
|---|---|
| Precise CV detection / bounding-box accuracy claims / custom YOLO training | Gemini's boxes are coarse; fine-tuned detectors top out ~0.76 F1; training is out of scope. Use Gemini for classification/judgment, not as a precise detector. |
| Pothole depth / volume in mm | Needs stereo/3D rigs; a single phone photo can't do it reliably. |
| A trained predictive forecaster | Not weekend-trainable; clustering over seeded data gives the same visual story honestly. |
| Public leaderboards ranked by report volume + prizes/points-as-motivator | Backfire is well-evidenced: overjustification crowds out intrinsic motivation (Deci/Koestner/Ryan, 128 experiments), leaderboards reduced performance and learning (Pedersen; Hanus & Fox), volume ranking distorts data quality, Decide Madrid's high bar bred disillusionment. High risk, low payoff. |
| Claiming real government auto-filing | No public write-APIs exist (CPGRAMS/RTI/municipal). We *prepare and assist-submit*, stop at legal/payment gates, and simulate the officer side faithfully against real schemas. Honesty is a feature here. |

---

## 5. The three surfaces

1. **Citizen app** (PWA, mobile-first) — capture, track, confirm, neighbourhood feed of collective wins.
2. **Authority / Officer portal** — simulated municipal side: queue sorted by support count, act, upload proof-of-fix. Makes the loop real for the demo.
3. **Public impact dashboard** — hotspot heatmap + honest resolution metrics. The transparency/accountability layer the brief asks for.

---

## 6. How resolution & escalation stay credible (not faked)

The mechanisms are real and citable; the orchestration across them is the missing piece we build. Design rule: **agent drafts, routes, tracks, escalates; human gives one-tap consent at legal/payment gates.** Put the *real SLA on screen* — specificity is credibility:

- **Swachhata:** garbage/most categories **12 hours**, dead animal **48 hours**, yellow-spot **1 week** (the most quotable SLA table in India; partner-gated integration actually exists).
- **CPGRAMS:** **21-day** redressal, 30-day appeal to a Nodal Appellate Authority — we prepare a CPGRAMS-ready grievance and track its clock.
- **Municipal charters:** GHMC potholes/streetlights **24 hours**; Chennai potholes **3 days**; BMC **3-day** target; helplines 1916/1913.
- **RTI** as escalation: PIO must reply in **30 days**, penalty Rs 250/day — the agent drafts the request (note-sheet, action-taken report, charter time-frame, reasons-for-delay); human submits and pays Rs 10.
- **Social:** one-tap post tagging the correct verified municipal/utility handle with the geotagged photo and breached SLA.

**Routing truth to encode:** pothole / road / garbage / drainage / streetlight fixture → **Municipal Corporation**; water leak / no water / sewer → **state Water Board**; power supply → **DISCOM** (street *lighting* is municipal, supply is the DISCOM's). The executive accountability target is the **Municipal Commissioner**, not the (often ceremonial) Mayor.

---

## 7. Technical foundation (summary — detail goes to the plan files)

**Reference architecture:** Next.js PWA on **Cloud Run** → **Firebase** (Auth, Firestore, Storage, FCM) → a **Genkit** agent flow calling **Gemini 2.5 Flash** → **Google Maps Platform** (pin, marker clustering, heatmap, geocoding).

**Data model = Open311 GeoReport v2** (the civic-tech standard) so we are interoperable with real 311 systems. Core record fields: `service_request_id`, `service_code`, `service_name`, `description`, `status`, `status_notes`, `lat`, `long`, `geohash` (our addition for nearby-duplicate queries), `address_string`, `media_url`, `agency_responsible`, `requested_/updated_/expected_datetime`. Full schemas live in `data-shapes.md`.

**Why Genkit:** its Developer UI shows step-by-step traces of each model/tool call — it literally renders the agent thinking, which is the demo and the Agentic-Depth evidence.

**Cost guardrails:** Gemini **Flash** free tier only; Maps under the per-SKU free caps (~10k Essentials events/mo); a Cloud Run budget alert. (Free-tier RPM/RPD is now per-account in AI Studio — verify the live number before the demo and degrade gracefully on cap.)

---

## 8. How each feature earns the rubric

| Criterion | Weight | What earns it |
|---|---:|---|
| Problem Solving & Impact | 20% | The loop actually closes; attacks the quantified false-closure pain |
| Agentic Depth | 20% | The 10-step autonomous Genkit flow with visible traces; autonomous escalation |
| Innovation & Creativity | 20% | Verified resolution + escalation — the empty column nobody fills |
| Usage of Google Technologies | 15% | Gemini + Maps + Firebase + Cloud Run + Genkit, all load-bearing |
| Product Experience & Design | 10% | Trust-first, motion-rich UI that shows the agent working |
| Technical Implementation | 10% | Open311-standard data model, real geo-queries, working pipeline |
| Completeness & Usability | 5% | Three surfaces, no dead ends, full loop demonstrable |

---

## 9. Anti-patterns we will not repeat (designed against the failure research)

- Never let a report die silently → guaranteed honest status updates.
- Never one-click "resolved" → citizen-confirmed, proof-of-fix required.
- Never silent-close duplicates → merge and amplify.
- Never vanity metrics → show resolution rate and median time, not report counts.
- Never volume leaderboards or cash rewards → outcome-feedback drives retention, not points.
- Never claim auto-filing we can't do → assisted-submit with visible human-in-the-loop gates.
- Never English-only or text-only → voice + photo + (stretch) vernacular for equity.

---

## 10. Evidence base (sources)

**Landscape / market gap:** FixMyStreet & FixMyStreet Pro (mysociety.org, societyworks.org); SeeClickFix/CivicPlus (civicplus.com); Snap Send Solve + ACCC penalty (accc.gov.au); NYC 311 "21.5% fixed" (council.nyc.gov/data/311-agency); San Antonio "closed≠resolved" (ksat.com); Open311 (open311.org, wiki.open311.org/GeoReport_v2); Swachhata (janaagraha.org, app reviews); CPGRAMS (pib.gov.in, impriindia.com); Pune feedback-before-closure directive (freepressjournal.in); Indore/Hyderabad/Mumbai municipal apps.

**Failure modes / retention:** Sjoberg, Mellon & Peixoto, *PAR* (+57%, n=399,364); Buntaine et al. (disengagement dilemma; Uganda waste, *JPART*); mySociety fix-rate data; AP grievances 85%/53% (thehansindia.com); Chicago OIG 311 audit (igchicago.org); OECD Trust Survey; equity/under-reporting (Liu & Garg, *Nature Computational Science*; arXiv:1710.02452).

**AI feasibility:** RDD2022 (arXiv:2209.08538) & CRDDC'2022 F1 0.76 (arXiv:2211.11362); TACO (arXiv:2003.06975); PaveCap severity r=0.70 (arXiv:2408.04110); Amsterdam classification F1 0.88 (Sukel); MLLM-as-a-Judge (arXiv:2402.04788); Memphis+Google Cloud potholes (publicsector.google); Gemini official docs (ai.google.dev/gemini-api/docs — image-understanding, structured-output, pricing, models).

**India resolution mechanics:** CPGRAMS 21-day OM (business-standard.com, staffnews.in); Swachhata Integration FAQ SLAs (swachh.city); GHMC/BMC/Chennai charters; RTI Act timelines & template (righttoinformation.wiki, rtionline.gov.in, cic.gov.in); Twitter Seva (sunilabraham.in); Right-to-Service / Sakala (en.wikipedia.org).

**Engagement science:** Schiff, *PAR* (collective input ~doubles closure); Haklay (redundancy plateaus ~13); Deci/Koestner/Ryan (overjustification); Pedersen, Hanus & Fox (leaderboard/longitudinal harm); Royo et al. (Decide Madrid); Medhi et al. (0% text vs 72% voice); Douceur (Sybil); FixMyStreet admin manual (reactive moderation).

**Open source / Google stack:** FixMyStreet & Spothole repos (github.com); Open311 GeoReport v2 spec; Firebase geoqueries/GeoFirestore (firebase.google.com); Maps Platform pricing (developers.google.com/maps); Cloud Run Next.js quickstart; Genkit (genkit.dev).

*(Full URL list retained in the research briefs that produced this document.)*

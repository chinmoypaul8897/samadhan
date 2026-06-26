# data-shapes.md — Data Source of Truth

> Authoritative for **every** data structure: Firestore collections, field names + types, enums, agent-step I/O contracts, storage paths, indexes, and security-rule intent. Any shape lands here **first**, then plan/code follow. No shape exists anywhere unless it exists here.
> Product context: `what-to-build.md`. Build rules: `CLAUDE.md`. External bindings: Open311 GeoReport v2 (`wiki.open311.org/GeoReport_v2`), Firebase Firestore geoqueries (`firebase.google.com/docs/firestore/solutions/geoqueries`), geofire-common.

---

## 0. Conventions (read first)

- **Database:** Cloud Firestore (native mode). **Field naming:** `camelCase`. **Collections:** plural lowerCamel.
- **Timestamps:** Firestore `Timestamp`, written with `serverTimestamp()`. Every doc has `createdAt` + `updatedAt`.
- **Location:** stored twice — `location: GeoPoint` (lat/lng) **and** `geohash: string` (10-char, from `geofire-common`'s `geohashForLocation`). Nearby queries use `geohashQueryBounds(center, radiusM)`; results are range-filtered then distance-filtered in code (per the Firebase geoqueries doc).
- **Money/units:** distances in metres (`...M` suffix), durations in hours (`...Hours`) unless a `Timestamp`.
- **IDs:** Firestore auto-IDs for `reports`, `issues`, `users` (= Firebase Auth `uid`). `serviceCatalog` and `authorities` use human-readable slugs as the doc ID.
- **Citizen-facing reference:** `issue.trackingId`, format `SMD-XXXXXXXX` (8 chars, Crockford base32, no embedded date).
- **Type notation below:** TS-style. `?` = optional. `enum→§9` points to the enum table. `T[]` = array. `Map<K,V>` = Firestore map.
- **Tiering:** fields tagged `[T2]` belong to SECONDARY features (`what-to-build.md` §4) — define now, populate later. Everything else is CORE.

---

## 1. Entity-relationship map

```
users/{uid}                      citizens, officers, admins
serviceCatalog/{serviceCode}     Open311 service catalogue + default dept + SLA   (seed/reference)
authorities/{authorityId}        the bodies we route to (corp / water / discom)   (seed/reference)

reports/{reportId}               ONE citizen submission; runs the intake pipeline
   └─ pipeline: StepTrace[]      the live "agent thinking" trace (embedded array)

issues/{issueId}                 the canonical, de-duplicated physical problem  (= Open311 service request)
   ├─ activity/{activityId}      lifecycle timeline (status changes, officer actions)
   ├─ escalations/{escalationId} RTI / appeal / social drafts generated on SLA breach
   └─ confirmations/{uid}        one-tap "me too" [T2]

Relationships:
  report.reporterUid → users/{uid}
  report.issueId     → issues/{issueId}        (set by Dedup; null while processing)
  issue.serviceCode  → serviceCatalog/{serviceCode}
  issue.routing.authorityId → authorities/{authorityId}
  issue.assignedOfficerUid  → users/{uid}      (role=officer)
  issue.reportCount / supporterCount are denormalised counters
```

Media lives in Cloud Storage (§4), referenced by `path` + `downloadUrl`.

---

## 2. `users/{uid}`

Doc ID = Firebase Auth `uid`. Surfaces: all.

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `uid` | string | ✓ | = doc ID |
| `role` | enum→§9 | ✓ | `citizen` \| `officer` \| `admin` |
| `displayName` | string | ✓ | "Anonymous Citizen" if anon |
| `isAnonymous` | boolean | ✓ | Firebase anonymous auth, upgradeable |
| `phone` | string? |  | E.164; set on phone-OTP upgrade [T2] |
| `email` | string? |  | |
| `photoUrl` | string? |  | |
| `languagePref` | enum→§9 | ✓ | `en` \| `hi` (default `en`) |
| `homeLocation` | GeoPoint? |  | for "near me" defaulting |
| `homeGeohash` | string? |  | |
| `fcmTokens` | string[] | ✓ | push targets; `[]` default |
| `createdAt` / `updatedAt` / `lastActiveAt` | Timestamp | ✓ | |
| `trustScore` | number? |  | [T2] quiet anti-abuse weight, 0–100 |
| `reportsCount` / `confirmedFixesCount` | number? |  | [T2] quiet stats — **never** a public leaderboard (CLAUDE.md anti-pattern) |
| **Officer-only** | | | present when `role=officer` |
| `authorityId` | string? |  | → `authorities/{id}` |
| `department` | string? |  | e.g. "Roads", "Water Supply" |
| `jurisdictionWards` | string[]? |  | wards this officer can act on |

---

## 3. `serviceCatalog/{serviceCode}`  (seed/reference; Open311 Service List)

Doc ID = `serviceCode` slug (e.g. `pothole`, `garbage_dump`, `streetlight`, `water_leak`, `sewer_overflow`, `power_outage`, `stagnant_water`, `dead_animal`). Surfaces: agent Route/Act, citizen category UI.

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `serviceCode` | string | ✓ | = doc ID; Open311 `service_code` |
| `serviceName` | string | ✓ | "Pothole" |
| `group` | enum→§9 | ✓ | `roads` \| `water` \| `sanitation` \| `electricity` \| `other` |
| `keywords` | string[] | ✓ | for matching free text |
| `defaultAuthorityType` | enum→§9 | ✓ | `municipal_corporation` \| `water_board` \| `discom` \| `other` |
| `defaultDepartment` | string | ✓ | "Roads & Infrastructure" |
| `slaHours` | number | ✓ | from real charters (see `slaSource`) |
| `slaSource` | string | ✓ | citation, e.g. "GHMC Citizen Charter: potholes 24h" |
| `hazardDefault` | boolean | ✓ | true for open_manhole etc. |
| `requiresMetadata` | boolean | ✓ | Open311 `metadata` flag |
| `description` | string | ✓ | |

**Seed example:**
```json
{ "serviceCode": "pothole", "serviceName": "Pothole", "group": "roads",
  "keywords": ["pothole","road damage","crater","gadda"],
  "defaultAuthorityType": "municipal_corporation", "defaultDepartment": "Roads & Infrastructure",
  "slaHours": 24, "slaSource": "GHMC Citizen Charter (potholes 24h)",
  "hazardDefault": false, "requiresMetadata": false,
  "description": "Damaged road surface / pothole." }
```

---

## 4. `authorities/{authorityId}`  (seed/reference)

Doc ID = slug (e.g. `bbmp`, `bwssb`, `bescom`). Surfaces: agent Route/Escalate, dashboard. **Demo city: Bengaluru** (BBMP corp + BWSSB water + BESCOM power = full routing demo).

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `authorityId` | string | ✓ | = doc ID |
| `name` | string | ✓ | "Bruhat Bengaluru Mahanagara Palike" |
| `shortName` | string | ✓ | "BBMP" |
| `type` | enum→§9 | ✓ | authorityType |
| `city` / `state` | string | ✓ | "Bengaluru" / "Karnataka" |
| `jurisdictionWards` | string[] | ✓ | ward names/codes covered |
| `departments` | string[] | ✓ | |
| `channels` | Map→below | ✓ | how the complaint is filed |
| `charterSlas` | Map<serviceCode, number>? |  | overrides `serviceCatalog.slaHours` for this body |
| `escalationContacts` | EscalationContact[] | ✓ | the real escalation ladder |
| `isSimulated` | boolean | ✓ | `true` — officer side is simulated for the demo |
| `createdAt`/`updatedAt` | Timestamp | ✓ | |

`channels: { app?: boolean; email?: string; portalUrl?: string; phone?: string; whatsapp?: string; social?: { platform: 'x'|'facebook'; handle: string } }`

`EscalationContact: { level: number; title: string; name?: string; email?: string; handle?: string }`
— e.g. `[{level:1,title:"Asst. Engineer"},{level:2,title:"Zonal Commissioner"},{level:3,title:"Municipal Commissioner"}]`. Accountability target = Commissioner, not Mayor (`what-to-build.md` §6).

---

## 5. `reports/{reportId}`  — one citizen submission

The unit the **intake pipeline** runs on (Capture→Perceive→Locate→Dedup→Route→Act). Surfaces: citizen capture + live agent trace.

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `id` | string | ✓ | = doc ID |
| `reporterUid` | string | ✓ | → users |
| `channel` | enum→§9 | ✓ | `app` (default) \| `whatsapp`[T2] |
| `status` | enum→§9 | ✓ | report status; starts `processing` |
| `createdAt`/`updatedAt` | Timestamp | ✓ | |
| `media` | Media→§7 | ✓ | the photo |
| `voiceNote` | VoiceNote→§7 ? |  | optional voice note |
| `rawText` | string? |  | any typed description |
| `location` | GeoPoint | ✓ | device GPS at capture |
| `geohash` | string | ✓ | 10-char |
| `accuracyM` | number? |  | GPS accuracy |
| `analysis` | PerceiveOutput→§8.1 ? |  | set after Perceive; null while processing |
| `dedup` | DedupResult→below ? |  | set after Dedup |
| `issueId` | string? |  | set after Dedup (linked or seeded) |
| `isSeed` | boolean | ✓ | true if this report created the issue (default false) |
| `pipeline` | StepTrace[]→below | ✓ | the live agent-thinking trace |

`DedupResult: { decision: 'new'|'linked'; candidateIssueIds: string[]; matchedIssueId?: string; confidence: number; reasoning: string }`

`StepTrace: { step: enum→§9 (pipelineStep); status: 'pending'|'running'|'done'|'error'|'skipped'; summary: string; startedAt?: Timestamp; finishedAt?: Timestamp; latencyMs?: number; error?: string }`
— intake steps: `perceive, locate, dedup, route, act`. (`track/escalate/verify/learn` are issue-lifecycle, recorded on the issue, not here.)

**Example (post-intake, linked as a supporter):**
```json
{ "id":"r_8fK2","reporterUid":"u_abc","channel":"app","status":"linked",
  "media":{"path":"reports/u_abc/r_8fK2/original.jpg","downloadUrl":"https://...","contentType":"image/jpeg","sizeBytes":184320,"exifGps":{"lat":12.9716,"lng":77.5946},"capturedAt":{"_ts":1}},
  "location":{"lat":12.9716,"lng":77.5946},"geohash":"tdr1y8wxz0","accuracyM":8,
  "analysis":{"isCivicIssue":true,"confidence":0.94,"serviceCode":"pothole","serviceName":"Pothole","subCategory":"deep pothole","severity":"high","hazard":false,"caption":"Large water-filled pothole on a two-lane road","ocrText":null,"suggestedTitle":"Deep pothole near 80ft Road","tags":["road","monsoon"],"languageDetected":"en","reasoning":"Clear road-surface failure ~40cm wide."},
  "dedup":{"decision":"linked","candidateIssueIds":["i_77a"],"matchedIssueId":"i_77a","confidence":0.91,"reasoning":"Same location radius 18m, same category, matching visual."},
  "issueId":"i_77a","isSeed":false,
  "pipeline":[{"step":"perceive","status":"done","summary":"Pothole, high severity","latencyMs":1320},{"step":"locate","status":"done","summary":"80ft Road, Indiranagar ward","latencyMs":280},{"step":"dedup","status":"done","summary":"Matched existing issue (12 supporters)","latencyMs":540},{"step":"route","status":"skipped","summary":"Inherited from existing issue"},{"step":"act","status":"skipped","summary":"Already filed"}],
  "createdAt":{"_ts":1},"updatedAt":{"_ts":1} }
```

---

## 6. `issues/{issueId}`  — the canonical problem (Open311 service request)

The de-duplicated physical issue. Surfaces: citizen tracking, officer portal, public dashboard. (Open311 mapping in §11.)

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `id` | string | ✓ | = doc ID = Open311 `service_request_id` |
| `trackingId` | string | ✓ | `SMD-XXXXXXXX`, citizen-facing |
| `status` | enum→§9 | ✓ | issue status state machine |
| `statusNotes` | string | ✓ | reason for current status (`""` ok) |
| `serviceCode`/`serviceName`/`group` | string | ✓ | category (→ serviceCatalog) |
| `subCategory` | string? |  | |
| `severity` | enum→§9 | ✓ | `low`\|`medium`\|`high` |
| `hazard` | boolean | ✓ | safety-critical flag |
| `title` | string | ✓ | editable; from `suggestedTitle` |
| `description` | string | ✓ | |
| `location` | GeoPoint | ✓ | |
| `geohash` | string | ✓ | 10-char (dedup queries) |
| `addressString` | string | ✓ | reverse-geocoded |
| `ward`/`zone`/`city`/`zipcode` | string? |  | from Locate |
| `beforeMedia` | Media→§7 | ✓ | representative/seed photo |
| `mediaPaths` | string[] | ✓ | all linked report photos |
| `reportCount` | number | ✓ | full reports linked (≥1) |
| `supporterCount` | number | ✓ | unique reporters + confirmers (the "N citizens" number) |
| `routing` | Routing→§8.3 | ✓ | from Route step |
| `agencyResponsible` | string | ✓ | denormalised authority name (Open311) |
| `sla` | Sla→below | ✓ | the live clock |
| `filing` | Filing→§8.4 | ✓ | the prepared/submitted complaint |
| `verification` | Verification→§8.6 | ✓ | the differentiator |
| `escalationLevel` | number | ✓ | 0 = none |
| `lastEscalatedAt` | Timestamp? |  | |
| `assignedOfficerUid` | string? |  | → users (officer) |
| `reporterUid` | string | ✓ | seed reporter |
| `tags` | string[] | ✓ | |
| `isPublic` | boolean | ✓ | default true |
| `resolvedAt`/`verifiedAt` | Timestamp? |  | |
| `createdAt`/`updatedAt` | Timestamp | ✓ | = Open311 requested_/updated_datetime |

`Sla: { slaHours: number; startedAt: Timestamp; deadline: Timestamp; state: enum→§9 (slaState) }`
— `deadline = startedAt + slaHours`; `state` recomputed by the Track step / scheduled function.

### `issues/{id}/activity/{activityId}`  — lifecycle timeline

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `type` | enum→§9 (activityType) | ✓ | `status_change`\|`officer_action`\|`new_supporter`\|`escalation`\|`verification`\|`comment`\|`system` |
| `message` | string | ✓ | human-readable |
| `actorUid` | string? |  | who; null = system/agent |
| `actorRole` | enum→§9 ? |  | |
| `fromStatus`/`toStatus` | enum→§9 ? |  | for `status_change` |
| `meta` | Map? |  | freeform |
| `createdAt` | Timestamp | ✓ | |

### `issues/{id}/escalations/{escalationId}`  — generated on SLA breach

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `type` | enum→§9 (escalationType) | ✓ | `rti_draft`\|`higher_authority_appeal`\|`social_post`\|`reminder` |
| `status` | enum→§9 (escalationStatus) | ✓ | `drafted`\|`approved`\|`sent`\|`acknowledged` |
| `channel` | enum→§9 | ✓ | where it goes |
| `content` | string | ✓ | the drafted text (RTI/appeal/tweet) |
| `target` | string | ✓ | PIO / handle / authority+level |
| `triggerReason` | string | ✓ | "SLA breached by 6h" |
| `approvedByUid` | string? |  | the human one-tap consent |
| `createdAt`/`sentAt` | Timestamp | ✓/? | |

### `issues/{id}/confirmations/{uid}` [T2]  — one-tap "me too"
`{ uid: string; comment?: string; createdAt: Timestamp }` (doc ID = uid → one per user; increments `supporterCount`).

---

## 7. Cloud Storage layout + media shapes

Bucket paths (citizen uploads are **uid-scoped** so the Storage rule can enforce `auth.uid == {uid}` — C1):
```
reports/{uid}/{reportId}/original.jpg    citizen photo (required); {uid} = reporterUid
reports/{uid}/{reportId}/voice.webm      optional voice note
issues/{issueId}/before.jpg              copy/ref of seed photo (representative)
issues/{issueId}/after/{actorUid}.jpg    resolution proof (officer or citizen)
```

`Media: { path: string; downloadUrl: string; contentType: string; sizeBytes: number; capturedAt?: Timestamp; exifGps?: { lat: number; lng: number } }`
`VoiceNote: { path: string; downloadUrl: string; transcript?: string; language?: string }`

Rule: EXIF GPS is **advisory only** (spoofable, per research) — device `location` is primary; mismatch is a verification signal, not a hard block.

---

## 8. Agent-step I/O contracts (Gemini `responseSchema`)

Each is the exact JSON the Gemini call must return (enforced via Genkit/`responseSchema`). Field names match where they land in §5/§6b to avoid translation.

### 8.1 Perceive → `report.analysis`
```ts
PerceiveOutput {
  isCivicIssue: boolean;          // false ⇒ report.status='rejected'
  confidence: number;             // 0..1
  serviceCode: string;            // must exist in serviceCatalog
  serviceName: string;
  subCategory?: string;
  severity: 'low'|'medium'|'high';
  hazard: boolean;
  caption: string;
  ocrText: string|null;           // any sign/landmark text read
  suggestedTitle: string;
  tags: string[];
  languageDetected: string;       // ISO 639-1
  reasoning: string;              // short
}
```

### 8.2 Dedup → `report.dedup`
Input: candidate issues (id, beforeMedia, location, serviceCode) + this report's photo/location.
```ts
DedupVerdict { sameIssue: boolean; confidence: number; reasoning: string }
```
(Pre-gate in code: geohash radius ≤ 50 m **and** compatible `serviceCode` **and** issue status active, before asking Gemini.)

### 8.3 Route → `issue.routing`
```ts
Routing {
  authorityType: 'municipal_corporation'|'water_board'|'discom'|'other';
  authorityId: string;            // → authorities/{id}
  department: string;
  channel: 'app'|'email'|'portal'|'phone'|'whatsapp'|'social';
  confidence: number;
  reasoning: string;
}
```

### 8.4 Act → `issue.filing`
```ts
Filing {
  status: 'draft'|'prepared'|'submitted'|'failed';
  complaintText: string;          // formal complaint in target language/format
  language: string;
  format: string;                 // e.g. 'cpgrams'|'municipal_portal'|'email'
  externalRef?: string;           // tracking id from the external system, if any
  submittedAt?: Timestamp;
  consentByUid?: string;          // human one-tap consent at the gate
}
```

### 8.5 Escalate → `escalations/{id}.content`
```ts
EscalateOutput {
  type: 'rti_draft'|'higher_authority_appeal'|'social_post'|'reminder';
  content: string;                // ready-to-send text
  target: string;                 // PIO / @handle / authority+level
  reasoning: string;
}
```

> **C10 derivation note.** The **Gemini** call returns only `{content, reasoning}` (the drafted text + why); `type`/`target`/`channel`/`triggerReason` are set **in code** from the breach rung (`escalationLevel+1`) + `authority.escalationContacts` (titles only — the agent never fabricates a name/handle, mirroring C6 "Route is rules"). Rungs: L1 `reminder` (grievance desk) → L2 `higher_authority_appeal` (next escalation contact) → L3 `rti_draft` (PIO). `social_post` is an available type but not a default rung (no real handle is seeded).

### 8.6 Verify → `issue.verification`
```ts
Verification {
  required: boolean;
  beforeMediaPath: string;
  afterMediaPath?: string;
  aiVerdict?: { resolved: boolean; confidence: number; reasoning: string;
                gpsMatch: boolean; timestampMatch: boolean };
  citizenConfirmed?: boolean;
  confirmedByUid?: string;
  outcome?: 'verified'|'rejected'|'auto';   // 'auto' = grace-window auto-confirm
  finalizedAt?: Timestamp;
}
```
Rule: `status='verified_resolved'` only when `citizenConfirmed===true` **or** `outcome==='auto'`. AI verdict alone never finalises (CLAUDE.md anti-pattern: no one-click resolved).

> **C9 derivation note.** `aiVerdict` is computed when the officer resolves: Gemini compares before vs after → `{resolved, confidence, reasoning}`. `gpsMatch` is the agent's **visual same-location** judgment (Gemini `sameLocation`), NOT device GPS — the client downscale (canvas re-encode) strips EXIF, and the officer portal is simulated (the officer isn't physically at the issue, so device GPS would false-flag every legitimate resolve). `timestampMatch` = the after photo was provided after the report (`resolvedAt > createdAt`). Both are advisory; only the citizen confirm (or `outcome:'auto'`) finalises.

---

## 9. Enums & state machines

```
role:            citizen | officer | admin
languagePref:    en | hi                        (extensible)
group:           roads | water | sanitation | electricity | other
authorityType:   municipal_corporation | water_board | discom | other
channel:         app | whatsapp | email | portal | phone | social
severity:        low | medium | high
pipelineStep:    perceive | locate | dedup | route | act
                  (lifecycle: track | escalate | verify | learn — on issue, not report)

reportStatus:    processing → (needs_review) → seeded | linked | rejected
issueStatus:     submitted → acknowledged → assigned → in_progress
                  → resolved_pending_verification → verified_resolved
                  ↳ cannot_fix (terminal, with statusNotes)
                  ↳ reopened (from resolved_pending_verification / verified_resolved → back to in_progress)
slaState:        on_track | due_soon | breached | met
activityType:    status_change | officer_action | new_supporter | escalation | verification | comment | system
escalationType:  rti_draft | higher_authority_appeal | social_post | reminder
escalationStatus: drafted | approved | sent | acknowledged
```

**Issue status transitions (allowed):**
```
submitted        → acknowledged | cannot_fix
acknowledged     → assigned | in_progress | cannot_fix
assigned         → in_progress | cannot_fix
in_progress      → resolved_pending_verification | cannot_fix
resolved_pending_verification → verified_resolved | reopened
verified_resolved → reopened            (recurrence)
reopened         → in_progress
```
`escalationLevel` is orthogonal — an issue can be `in_progress` **and** escalated. `slaState='breached'` is the escalation trigger.

---

## 10. Required composite indexes

| Collection | Fields | Used by |
|---|---|---|
| `issues` | `geohash` ASC (range) + `serviceCode` ASC | Dedup nearby-same-category |
| `issues` | `status` ASC + `sla.deadline` ASC | Track/escalate sweep (find breaching) |
| `issues` | `routing.authorityId` ASC + `status` ASC + `supporterCount` DESC | Officer queue (sorted by support) |
| `issues` | `isPublic` ASC + `createdAt` DESC | Public feed/dashboard |
| `issues` | `city` ASC + `group` ASC + `status` ASC | Dashboard filters / heatmap |
| `reports` | `reporterUid` ASC + `createdAt` DESC | "My reports" |
| `reports` | `issueId` ASC + `createdAt` ASC | Supporters of an issue |

(Single-field indexes are automatic. Geohash range queries follow the Firebase geoqueries pattern — multiple bounded range queries merged client/server-side.)

---

## 11. Open311 GeoReport v2 mapping (for export / interoperability)

| Our field (`issues`) | Open311 field | Note |
|---|---|---|
| `id` | `service_request_id` | |
| `serviceCode` | `service_code` | |
| `serviceName` | `service_name` | |
| `description` | `description` | |
| `status` (state machine) | `status` (`open`\|`closed`) | `verified_resolved`/`cannot_fix` → `closed`; else `open` |
| `statusNotes` | `status_notes` | |
| `location.lat/lng` | `lat` / `long` | |
| `addressString` | `address_string` | |
| `zipcode` | `zipcode` | |
| `beforeMedia.downloadUrl` | `media_url` | |
| `agencyResponsible` | `agency_responsible` | |
| `createdAt` | `requested_datetime` | ISO 8601 on export |
| `updatedAt` | `updated_datetime` | |
| `sla.deadline` | `expected_datetime` | |
| reporter fields | `email`/`first_name`/`last_name`/`phone`/`device_id` | optional |

---

## 12. Security-rules intent (full rules → `backend-plan.md`)

| Path | Read | Create | Update | Delete |
|---|---|---|---|---|
| `users/{uid}` | self + officers/admin | self (own uid) | self (own, non-role fields); admin (role) | — |
| `serviceCatalog/*` | public | admin | admin | admin |
| `authorities/*` | public | admin | admin | admin |
| `reports/{id}` | reporter + officers/admin | signed-in (reporterUid = auth.uid) | **server only** (pipeline writes analysis/dedup/issueId/status) | — |
| `issues/{id}` | public if `isPublic`, else reporter+officer | **server only** (created by intake) | **server only** + assigned officer (status/statusNotes/verification.after) | — |
| `issues/{id}/activity/*` | same as parent | **server only** | — | — |
| `issues/{id}/escalations/*` | reporter + officer | **server only** | reporter approve (`approvedByUid`) | — |
| `issues/{id}/confirmations/{uid}` | public | self (own uid) | — | self |

"Server only" = Cloud Run / Admin SDK via the agent flow; clients never write derived fields. Citizens never set `status`. Officers write only within `jurisdictionWards` / their `authorityId`.

---

## 13. Lifecycle in one line (how the shapes connect)

`report` created (status `processing`) → pipeline writes `analysis` → Dedup sets `issueId` (`linked`, bump `supporterCount`) **or** creates `issue` + sets `isSeed` (`seeded`) → issue runs Route→Act (`filing`), starts `sla` → Track flips `slaState`, writes `activity` → on breach, Escalate writes `escalations` (await one-tap `approvedByUid`) → officer acts (`resolved_pending_verification`, uploads `after` media) → Verify writes `verification` → citizen confirms → `verified_resolved`. Nothing derived is client-written.
```

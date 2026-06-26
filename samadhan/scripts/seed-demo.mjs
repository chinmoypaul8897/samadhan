// C14 — canonical demo dataset (backend-plan C14.2). Writes a realistic Bengaluru spread of
// `issues` (+ activity / escalations + before/after Storage photos) that lights up the live
// /dashboard, officer queue, escalation card and verify card. Shape-identical to what the
// intake pipeline writes (data-shapes §6) — concrete backdated Timestamps so SLA states +
// median-resolve are realistic.
//
// This is the ONE place we intentionally LEAVE data in the DB (every other chunk sweeps to
// pristine). Every seeded doc carries `demoSeed:true` so `--cleanup` is surgical — it never
// touches a real citizen's issue.
//
//   node scripts/seed-demo.mjs            # idempotent upsert (deterministic doc IDs)
//   node scripts/seed-demo.mjs --cleanup  # delete only demoSeed==true issues + their media
//
// Needs ADC (`gcloud auth application-default login`) + project from GOOGLE_CLOUD_PROJECT.

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp, GeoPoint } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";
import { geohashForLocation } from "geofire-common";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "samadhan-civic-7k4m2";
const bucketName = `${projectId}.firebasestorage.app`;

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId, storageBucket: bucketName });
}
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();
const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "demo-assets");

const cleanup = process.argv.includes("--cleanup");
const now = Date.now();
const H = 3600_000;
const at = (hoursAgo) => Timestamp.fromMillis(now - hoursAgo * H);

// Deterministic SMD-XXXXXXXX from a key (stable tracking IDs across reseeds; valid Crockford).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function tid(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[h & 31];
    h = Math.floor(h / 31) + ((h & 31) + i) * 7 + 1;
  }
  return `SMD-${out}`;
}

// ── authority / catalogue facts (mirror scripts/seed.mjs; no app imports in a bare .mjs) ──
const AUTH = {
  bbmp: { id: "bbmp", type: "municipal_corporation", name: "Bruhat Bengaluru Mahanagara Palike", short: "BBMP", l1: "Assistant Executive Engineer" },
  bwssb: { id: "bwssb", type: "water_board", name: "Bangalore Water Supply and Sewerage Board", short: "BWSSB", l1: "Assistant Engineer" },
  bescom: { id: "bescom", type: "discom", name: "Bangalore Electricity Supply Company", short: "BESCOM", l1: "Assistant Engineer" },
};
const CAT = {
  pothole: { name: "Pothole", group: "roads", dept: "Roads & Infrastructure", sla: 24, auth: "bbmp" },
  garbage_dump: { name: "Garbage dump", group: "sanitation", dept: "Solid Waste Management", sla: 12, auth: "bbmp" },
  streetlight: { name: "Streetlight", group: "electricity", dept: "Street Lighting", sla: 24, auth: "bbmp" },
  dead_animal: { name: "Dead animal", group: "sanitation", dept: "Solid Waste Management", sla: 48, auth: "bbmp" },
  stagnant_water: { name: "Stagnant water", group: "sanitation", dept: "Health & Vector Control", sla: 48, auth: "bbmp" },
  sewer_overflow: { name: "Sewer overflow", group: "water", dept: "Sewerage", sla: 12, auth: "bwssb" },
  water_leak: { name: "Water leak", group: "water", dept: "Water Supply", sla: 24, auth: "bwssb" },
  power_outage: { name: "Power outage", group: "electricity", dept: "Power Supply", sla: 24, auth: "bescom" },
};
const WARD = {
  Koramangala: [12.9352, 77.6245], Indiranagar: [12.9719, 77.6412], Jayanagar: [12.925, 77.5938],
  Shivajinagar: [12.9853, 77.605], Hebbal: [13.0358, 77.597], Malleshwaram: [13.0035, 77.571],
};

// ── the canonical spread: all groups, the full status machine, 4 verified (before+after),
// 1 pending-verify, 1 breached+escalated, 1 breached, varied supporterCount + 2 hotspots ──
const SPREAD = [
  { key: "korpot", code: "pothole", ward: "Koramangala", jit: [0.0008, 0.0006], sev: "high", hazard: false, status: "verified_resolved", supporters: 14, createdAgo: 30, resolvedAgo: 12, communityFixed: 6, title: "Deep pothole near Sony World junction" },
  { key: "indgar", code: "garbage_dump", ward: "Indiranagar", jit: [0.0009, -0.0005], sev: "medium", hazard: false, status: "verified_resolved", supporters: 9, createdAgo: 26, resolvedAgo: 14, communityFixed: 3, title: "Garbage pile-up on 100ft Road service lane" },
  { key: "jaystr", code: "streetlight", ward: "Jayanagar", jit: [-0.0006, 0.0007], sev: "low", hazard: false, status: "verified_resolved", supporters: 5, createdAgo: 40, resolvedAgo: 10, title: "Dark stretch — streetlight out near 4th Block" },
  { key: "korani", code: "dead_animal", ward: "Koramangala", jit: [-0.0007, -0.0008], sev: "medium", hazard: false, status: "verified_resolved", supporters: 3, createdAgo: 50, resolvedAgo: 8, title: "Animal carcass on the 80ft Road median" },
  { key: "hebwat", code: "water_leak", ward: "Hebbal", jit: [0.0005, 0.0004], sev: "high", hazard: false, status: "resolved_pending_verification", supporters: 7, createdAgo: 20, resolvedAgo: 3, communityFixed: 4, communityBroken: 1, title: "Burst water line flooding the underpass approach" },
  { key: "shisew", code: "sewer_overflow", ward: "Shivajinagar", jit: [0.0006, -0.0006], sev: "high", hazard: true, status: "in_progress", supporters: 11, createdAgo: 30, breached: true, escalated: true, title: "Sewer overflowing onto the footpath" },
  { key: "korpow", code: "power_outage", ward: "Koramangala", jit: [0.0003, -0.0009], sev: "high", hazard: false, status: "in_progress", supporters: 6, createdAgo: 8, title: "Transformer failure — 6th Block without power" },
  { key: "malpot", code: "pothole", ward: "Malleshwaram", jit: [0.0004, 0.0005], sev: "medium", hazard: false, status: "acknowledged", supporters: 3, createdAgo: 10, title: "Pothole cluster near Mantri Mall" },
  { key: "indstr", code: "streetlight", ward: "Indiranagar", jit: [-0.0008, 0.0006], sev: "low", hazard: false, status: "assigned", supporters: 2, createdAgo: 14, title: "Flickering streetlight on 12th Main" },
  { key: "jaysta", code: "stagnant_water", ward: "Jayanagar", jit: [0.0007, -0.0004], sev: "medium", hazard: false, status: "submitted", supporters: 1, createdAgo: 4, title: "Stagnant water breeding mosquitoes behind the park" },
  { key: "hebgar", code: "garbage_dump", ward: "Hebbal", jit: [-0.0005, 0.0008], sev: "medium", hazard: false, status: "cannot_fix", supporters: 4, createdAgo: 36, title: "Dumping on a private plot off the Ring Road", note: "Site is private land — referred to the estate owner; outside municipal jurisdiction." },
  { key: "shiwat", code: "water_leak", ward: "Shivajinagar", jit: [-0.0004, -0.0007], sev: "medium", hazard: false, status: "reopened", supporters: 3, createdAgo: 28, title: "Water leak recurred after the first repair" },
  { key: "indsew", code: "sewer_overflow", ward: "Indiranagar", jit: [0.001, 0.0007], sev: "high", hazard: true, status: "submitted", supporters: 8, createdAgo: 20, breached: true, title: "Blocked sewer flooding the lane near CMH Road" },
];

const FILED = new Set(["acknowledged", "assigned", "in_progress", "resolved_pending_verification", "verified_resolved", "cannot_fix", "reopened"]);
const HAS_OFFICER = new Set(["assigned", "in_progress", "resolved_pending_verification", "verified_resolved", "reopened"]);
const ACTIVE = new Set(["submitted", "acknowledged", "assigned", "in_progress", "reopened"]);

function complaintText(s, c, a) {
  return [
    `To the ${c.dept} department, ${a.name} (${a.short}),`,
    ``,
    `Subject: ${s.title} — ${s.ward}, Bengaluru.`,
    ``,
    `A ${c.name.toLowerCase()} has been reported at ${s.ward} and is affecting residents in the area${s.hazard ? ", and presents a safety hazard" : ""}. ${s.supporters} ${s.supporters === 1 ? "citizen has" : "citizens have"} reported or confirmed this issue. We request inspection and resolution within the ${c.sla}-hour service window for this category.`,
    ``,
    `Filed via Samadhan. Tracking ID: ${tid(s.key)}.`,
  ].join("\n");
}

async function officerUid(authorityId) {
  try {
    return (await auth.getUserByEmail(`officer.${authorityId}@samadhan.local`)).uid;
  } catch {
    return null;
  }
}

function publicUrl(path) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media`;
}

async function uploadAsset(localName, destPath) {
  const local = join(assetsDir, localName);
  await bucket.upload(local, { destination: destPath, metadata: { contentType: "image/jpeg" } });
  return { path: destPath, sizeBytes: statSync(local).size, downloadUrl: publicUrl(destPath) };
}

// Build the activity timeline for an issue's journey (chronological; types per data-shapes §9).
function journey(s, c, a, officer, createdMs, endMs) {
  const span = Math.max(endMs - createdMs, H);
  const rows = [];
  const push = (frac, row) => rows.push({ ...row, createdAt: Timestamp.fromMillis(createdMs + span * frac) });
  push(0, { type: "system", message: "Issue created", actorUid: null });
  if (FILED.has(s.status)) push(0.05, { type: "system", message: `Complaint filed to ${a.name}`, actorUid: null });
  const reached = (st) => ["acknowledged", "assigned", "in_progress", "resolved_pending_verification", "verified_resolved", "cannot_fix", "reopened"].indexOf(s.status) >= ["acknowledged", "assigned", "in_progress", "resolved_pending_verification", "verified_resolved", "cannot_fix", "reopened"].indexOf(st);
  const off = { actorUid: officer, actorRole: "officer" };
  if (reached("acknowledged")) push(0.2, { type: "status_change", message: "Acknowledged by the authority", fromStatus: "submitted", toStatus: "acknowledged", ...off });
  if (s.status === "cannot_fix") {
    push(0.5, { type: "status_change", message: s.note || "Marked cannot fix", fromStatus: "acknowledged", toStatus: "cannot_fix", ...off });
  } else {
    if (reached("assigned")) push(0.35, { type: "status_change", message: "Assigned to a field officer", fromStatus: "acknowledged", toStatus: "assigned", ...off });
    if (reached("in_progress")) push(0.5, { type: "status_change", message: "Work started on site", fromStatus: "assigned", toStatus: "in_progress", ...off });
    if (["resolved_pending_verification", "verified_resolved", "reopened"].includes(s.status)) push(0.75, { type: "status_change", message: "Marked resolved — proof photo uploaded", fromStatus: "in_progress", toStatus: "resolved_pending_verification", ...off });
    if (s.status === "verified_resolved") {
      push(0.9, { type: "verification", message: "Agent before/after check: looks resolved", actorUid: null });
      push(0.97, { type: "status_change", message: "Citizen confirmed the fix", fromStatus: "resolved_pending_verification", toStatus: "verified_resolved", actorUid: "demo-citizen", actorRole: "citizen" });
    }
    if (s.status === "reopened") push(0.9, { type: "status_change", message: "Citizen reported it is still broken — reopened", fromStatus: "resolved_pending_verification", toStatus: "reopened", actorUid: "demo-citizen", actorRole: "citizen" });
  }
  if (s.escalated) push(0.85, { type: "escalation", message: `SLA breached — escalated to the ${a.l1}`, actorUid: null });
  // a couple of "me too" rows on the high-support issues
  if (s.supporters >= 8) { push(0.4, { type: "new_supporter", message: "Another citizen is affected by this", actorUid: null }); push(0.6, { type: "new_supporter", message: "Another citizen is affected by this", actorUid: null }); }
  return rows;
}

async function deleteIssue(doc) {
  for (const sub of ["activity", "escalations", "confirmations", "fixConfirmations"]) {
    const subSnap = await doc.ref.collection(sub).get();
    let batch = db.batch();
    subSnap.docs.forEach((d) => batch.delete(d.ref));
    if (subSnap.size) await batch.commit();
  }
  await bucket.deleteFiles({ prefix: `issues/${doc.id}/` }).catch(() => {});
  await doc.ref.delete();
}

async function doCleanup() {
  const snap = await db.collection("issues").where("demoSeed", "==", true).get();
  console.log(`Cleanup: ${snap.size} demoSeed issues…`);
  for (const doc of snap.docs) await deleteIssue(doc);
  console.log("Cleanup done.");
}

async function seedOne(s) {
  const c = CAT[s.code];
  const a = AUTH[c.auth];
  const id = `demo-${s.key}`;
  const ref = db.collection("issues").doc(id);
  const [blat, blng] = WARD[s.ward];
  const lat = blat + s.jit[0];
  const lng = blng + s.jit[1];
  const createdMs = now - s.createdAgo * H;
  const officer = HAS_OFFICER.has(s.status) ? await officerUid(c.auth) : null;

  // wipe prior subcollections/media for a clean idempotent upsert
  const prior = await ref.get();
  if (prior.exists) await deleteIssue(prior);

  // before photo (every issue) + after photo (resolved / pending)
  const before = await uploadAsset(`before-${s.code}.jpg`, `issues/${id}/before.jpg`);
  let afterPath = null;
  if (["verified_resolved", "resolved_pending_verification"].includes(s.status)) {
    const aOff = officer || (await officerUid(c.auth)) || "demo-officer";
    const up = await uploadAsset(`after-${s.code}.jpg`, `issues/${id}/after/${aOff}.jpg`);
    afterPath = up.path;
  }

  const resolvedMs = s.resolvedAgo != null ? now - s.resolvedAgo * H : null;
  const verifiedMs = s.status === "verified_resolved" ? resolvedMs : null;
  const deadlineMs = createdMs + c.sla * H;
  let slaState = "on_track";
  if (resolvedMs != null) slaState = resolvedMs <= deadlineMs ? "met" : "breached";
  else if (now > deadlineMs) slaState = "breached";
  else if (deadlineMs - now < c.sla * H * 0.25) slaState = "due_soon";

  const filing = FILED.has(s.status)
    ? { status: "submitted", complaintText: complaintText(s, c, a), language: "en", format: "municipal_portal", externalRef: null, submittedAt: Timestamp.fromMillis(createdMs + 0.5 * H), consentByUid: "demo-citizen" }
    : { status: "prepared", complaintText: complaintText(s, c, a), language: "en", format: "municipal_portal", externalRef: null };

  const verification = { required: true, beforeMediaPath: before.path };
  if (afterPath) {
    verification.afterMediaPath = afterPath;
    verification.aiVerdict = { resolved: true, confidence: 0.9, sameLocation: true, gpsMatch: true, timestampMatch: true, reasoning: "The after photo shows the reported problem cleared at the same location; timing is consistent with the work log." };
  }
  if (s.status === "verified_resolved") {
    verification.citizenConfirmed = true;
    verification.confirmedByUid = "demo-citizen";
    verification.outcome = "verified";
    verification.finalizedAt = Timestamp.fromMillis(verifiedMs);
  }
  if (s.communityFixed) verification.communityFixedCount = s.communityFixed;
  if (s.communityBroken) verification.communityBrokenCount = s.communityBroken;

  const issue = {
    id,
    demoSeed: true,
    trackingId: tid(s.key),
    status: s.status,
    statusNotes: s.status === "cannot_fix" ? s.note || "" : "",
    serviceCode: s.code,
    serviceName: c.name,
    group: c.group,
    subCategory: null,
    severity: s.sev,
    hazard: s.hazard,
    title: s.title,
    description: s.title,
    location: new GeoPoint(lat, lng),
    geohash: geohashForLocation([lat, lng]),
    addressString: `${s.ward}, Bengaluru, Karnataka`,
    ward: s.ward,
    zone: "Bengaluru",
    city: "Bengaluru",
    zipcode: null,
    beforeMedia: { ...before, contentType: "image/jpeg", capturedAt: at(s.createdAgo) },
    mediaPaths: [before.path],
    reportCount: 1,
    supporterCount: s.supporters,
    routing: { authorityType: a.type, authorityId: a.id, department: c.dept, channel: "portal", confidence: 0.95, reasoning: `${c.name} falls under ${a.short} ${c.dept}.` },
    agencyResponsible: a.name,
    sla: { slaHours: c.sla, startedAt: at(s.createdAgo), deadline: Timestamp.fromMillis(deadlineMs), state: slaState },
    filing,
    verification,
    escalationLevel: s.escalated ? 1 : 0,
    assignedOfficerUid: officer,
    reporterUid: "demo-citizen",
    tags: [c.group],
    isPublic: true,
    createdAt: at(s.createdAgo),
    updatedAt: Timestamp.fromMillis(resolvedMs ?? now),
  };
  if (resolvedMs != null) issue.resolvedAt = Timestamp.fromMillis(resolvedMs);
  if (verifiedMs != null) issue.verifiedAt = Timestamp.fromMillis(verifiedMs);
  if (s.escalated) issue.lastEscalatedAt = Timestamp.fromMillis(now - 1 * H);

  await ref.set(issue);

  const endMs = resolvedMs ?? now;
  const rows = journey(s, c, a, officer, createdMs, endMs);
  let batch = db.batch();
  for (const r of rows) batch.set(ref.collection("activity").doc(), r);
  await batch.commit();

  // Community fix-votes (advisory) on the pending/verified issues — synthetic neighbour uids.
  if (s.communityFixed || s.communityBroken) {
    let fb = db.batch();
    for (let i = 0; i < (s.communityFixed || 0); i++)
      fb.set(ref.collection("fixConfirmations").doc(`fixvote-${s.key}-${i}`), { uid: `fixvote-${s.key}-${i}`, verdict: "fixed", createdAt: at(s.resolvedAgo ?? 1) });
    for (let i = 0; i < (s.communityBroken || 0); i++)
      fb.set(ref.collection("fixConfirmations").doc(`brokvote-${s.key}-${i}`), { uid: `brokvote-${s.key}-${i}`, verdict: "broken", createdAt: at(s.resolvedAgo ?? 1) });
    await fb.commit();
  }

  if (s.escalated) {
    await ref.collection("escalations").doc().set({
      type: "reminder",
      status: "drafted",
      channel: "email",
      target: `${a.l1}, ${a.short}`,
      triggerReason: `SLA breached by ${Math.round((now - deadlineMs) / H)}h`,
      content: `Reminder to ${a.l1}, ${a.short} (${c.dept}):\n\nIssue ${tid(s.key)} (${s.title}, ${s.ward}) breached its ${c.sla}-hour service window and remains unresolved. ${s.supporters} citizens are affected. We request urgent action and a status update within 24 hours, failing which this will be escalated to the next authority and an RTI application may be filed for the action-taken report.`,
      createdAt: Timestamp.fromMillis(now - 1 * H),
    });
  }
  return { id, trackingId: issue.trackingId, status: s.status, ward: s.ward, serviceName: c.name };
}

async function main() {
  console.log(`Demo seed → project ${projectId} (bucket ${bucketName})`);
  if (cleanup) return doCleanup();

  const out = [];
  for (const s of SPREAD) out.push(await seedOne(s));

  const byStatus = out.reduce((m, r) => ((m[r.status] = (m[r.status] || 0) + 1), m), {});
  console.log(`Seeded ${out.length} issues:`);
  for (const r of out) console.log(`  ${r.id.padEnd(16)} ${r.trackingId}  ${r.status.padEnd(30)} ${r.serviceName} · ${r.ward}`);
  console.log("byStatus:", JSON.stringify(byStatus));
  console.log("Done. (run with --cleanup to remove)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

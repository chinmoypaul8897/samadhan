// Seed reference data + officer/admin accounts (backend-plan.md C1.6, data-shapes.md §3/§4).
// Idempotent: re-running upserts the same deterministic doc IDs and refreshes
// officer credentials into scripts/seed-output.local.json (gitignored).
//
// Run (with ADC):  node scripts/seed.mjs
//   needs Application Default Credentials — `gcloud auth application-default login`
//   or GOOGLE_APPLICATION_CREDENTIALS. Project from GOOGLE_CLOUD_PROJECT.
//
// Honesty: only verifiable facts (official portal domains, generic role titles)
// are seeded. No phone numbers / emails / personal names are invented; the
// officer side is simulated (isSimulated: true).

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "samadhan-civic-7k4m2";

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId });
}
const db = getFirestore();
const auth = getAuth();

// ─── serviceCatalog (8) ──────────────────────────────────────────────────────
const SERVICE_CATALOG = [
  {
    serviceCode: "pothole",
    serviceName: "Pothole",
    group: "roads",
    keywords: ["pothole", "road damage", "crater", "gadda", "road hole"],
    defaultAuthorityType: "municipal_corporation",
    defaultDepartment: "Roads & Infrastructure",
    slaHours: 24,
    slaSource: "GHMC Citizen Charter (potholes 24h)",
    hazardDefault: false,
    requiresMetadata: false,
    description: "Damaged road surface or pothole.",
  },
  {
    serviceCode: "streetlight",
    serviceName: "Streetlight",
    group: "electricity",
    keywords: ["streetlight", "street light", "lamp post", "dark street", "light not working"],
    defaultAuthorityType: "municipal_corporation",
    defaultDepartment: "Street Lighting",
    slaHours: 24,
    slaSource: "GHMC Citizen Charter (street lighting 24h)",
    hazardDefault: false,
    requiresMetadata: false,
    description: "Non-functional or damaged public streetlight.",
  },
  {
    serviceCode: "garbage_dump",
    serviceName: "Garbage dump",
    group: "sanitation",
    keywords: ["garbage", "trash", "waste", "kachra", "dump", "rubbish", "litter"],
    defaultAuthorityType: "municipal_corporation",
    defaultDepartment: "Solid Waste Management",
    slaHours: 12,
    slaSource: "Swachhata / GHMC norm (garbage clearance 12h)",
    hazardDefault: false,
    requiresMetadata: false,
    description: "Uncollected garbage or illegal dumping.",
  },
  {
    serviceCode: "sewer_overflow",
    serviceName: "Sewer overflow",
    group: "water",
    keywords: ["sewer", "sewage", "drain overflow", "gutter", "manhole overflow", "blocked drain"],
    defaultAuthorityType: "water_board",
    defaultDepartment: "Sewerage",
    slaHours: 12,
    slaSource: "Water board sewerage norm (overflow 12h, approx)",
    hazardDefault: true,
    requiresMetadata: false,
    description: "Overflowing sewer, manhole or sewage line.",
  },
  {
    serviceCode: "dead_animal",
    serviceName: "Dead animal",
    group: "sanitation",
    keywords: ["dead animal", "carcass", "dead dog", "dead cow", "animal carcass"],
    defaultAuthorityType: "municipal_corporation",
    defaultDepartment: "Solid Waste Management",
    slaHours: 48,
    slaSource: "GHMC norm (animal carcass removal 48h)",
    hazardDefault: false,
    requiresMetadata: false,
    description: "Animal carcass requiring removal.",
  },
  {
    serviceCode: "stagnant_water",
    serviceName: "Stagnant water",
    group: "sanitation",
    keywords: ["stagnant water", "mosquito", "breeding", "waterlogging", "still water"],
    defaultAuthorityType: "municipal_corporation",
    defaultDepartment: "Health & Vector Control",
    slaHours: 48,
    slaSource: "GHMC / Swachhata norm (stagnant water 48h)",
    hazardDefault: false,
    requiresMetadata: false,
    description: "Stagnant water / mosquito breeding site.",
  },
  {
    serviceCode: "water_leak",
    serviceName: "Water leak",
    group: "water",
    keywords: ["water leak", "pipe burst", "water pipe", "leakage", "no water"],
    defaultAuthorityType: "water_board",
    defaultDepartment: "Water Supply",
    slaHours: 24,
    slaSource: "Water board norm (leak repair 24h, approx)",
    hazardDefault: false,
    requiresMetadata: false,
    description: "Leaking or burst water supply line.",
  },
  {
    serviceCode: "power_outage",
    serviceName: "Power outage",
    group: "electricity",
    keywords: ["power", "electricity", "outage", "no power", "transformer", "current", "bijli"],
    defaultAuthorityType: "discom",
    defaultDepartment: "Power Supply",
    slaHours: 24,
    slaSource: "DISCOM norm (supply restoration 24h, approx)",
    hazardDefault: false,
    requiresMetadata: false,
    description: "Power supply failure or electrical fault.",
  },
  {
    serviceCode: "other",
    serviceName: "Other civic issue",
    group: "other",
    keywords: ["other", "general", "civic", "complaint", "miscellaneous"],
    defaultAuthorityType: "municipal_corporation",
    defaultDepartment: "General / Grievances",
    slaHours: 48,
    slaSource: "General grievance norm (approx)",
    hazardDefault: false,
    requiresMetadata: false,
    description: "A civic issue that doesn't fit the standard categories.",
  },
];

// ─── authorities (3, Bengaluru) ──────────────────────────────────────────────
// channels carry only verifiable official portal domains; titles, not names, in
// the escalation ladder. No fabricated phone/email/personal identities.
const AUTHORITIES = [
  {
    authorityId: "bbmp",
    name: "Bruhat Bengaluru Mahanagara Palike",
    shortName: "BBMP",
    type: "municipal_corporation",
    city: "Bengaluru",
    state: "Karnataka",
    jurisdictionWards: ["Indiranagar", "Shivajinagar", "Jayanagar", "Koramangala", "Hebbal", "Malleshwaram"],
    departments: ["Roads & Infrastructure", "Street Lighting", "Solid Waste Management", "Health & Vector Control"],
    channels: { app: true, portalUrl: "https://bbmp.gov.in" },
    charterSlas: { pothole: 24, streetlight: 24, garbage_dump: 12, dead_animal: 48, stagnant_water: 48 },
    escalationContacts: [
      { level: 1, title: "Assistant Executive Engineer" },
      { level: 2, title: "Zonal Commissioner" },
      { level: 3, title: "Municipal Commissioner" },
    ],
    isSimulated: true,
  },
  {
    authorityId: "bwssb",
    name: "Bangalore Water Supply and Sewerage Board",
    shortName: "BWSSB",
    type: "water_board",
    city: "Bengaluru",
    state: "Karnataka",
    jurisdictionWards: ["Indiranagar", "Shivajinagar", "Jayanagar", "Koramangala", "Hebbal", "Malleshwaram"],
    departments: ["Water Supply", "Sewerage"],
    channels: { app: true, portalUrl: "https://bwssb.karnataka.gov.in" },
    charterSlas: { water_leak: 24, sewer_overflow: 12 },
    escalationContacts: [
      { level: 1, title: "Assistant Engineer" },
      { level: 2, title: "Executive Engineer" },
      { level: 3, title: "Chairman, BWSSB" },
    ],
    isSimulated: true,
  },
  {
    authorityId: "bescom",
    name: "Bangalore Electricity Supply Company",
    shortName: "BESCOM",
    type: "discom",
    city: "Bengaluru",
    state: "Karnataka",
    jurisdictionWards: ["Indiranagar", "Shivajinagar", "Jayanagar", "Koramangala", "Hebbal", "Malleshwaram"],
    departments: ["Power Supply"],
    channels: { app: true, portalUrl: "https://bescom.karnataka.gov.in" },
    charterSlas: { power_outage: 24 },
    escalationContacts: [
      { level: 1, title: "Assistant Engineer" },
      { level: 2, title: "Executive Engineer" },
      { level: 3, title: "Managing Director, BESCOM" },
    ],
    isSimulated: true,
  },
];

// ─── officers (1 per authority) + 1 admin ────────────────────────────────────
const STAFF = [
  { email: "officer.bbmp@samadhan.local", role: "officer", authorityId: "bbmp", department: "Roads & Infrastructure", displayName: "BBMP Officer" },
  { email: "officer.bwssb@samadhan.local", role: "officer", authorityId: "bwssb", department: "Water Supply", displayName: "BWSSB Officer" },
  { email: "officer.bescom@samadhan.local", role: "officer", authorityId: "bescom", department: "Power Supply", displayName: "BESCOM Officer" },
  { email: "admin@samadhan.local", role: "admin", displayName: "Samadhan Admin" },
];

const wardsFor = (authorityId) =>
  AUTHORITIES.find((a) => a.authorityId === authorityId)?.jurisdictionWards ?? [];

async function upsert(collection, id, data) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  const payload = { ...data, updatedAt: FieldValue.serverTimestamp() };
  if (!snap.exists) payload.createdAt = FieldValue.serverTimestamp();
  await ref.set(payload, { merge: true });
}

async function ensureStaffUser(s) {
  const password = process.env.SEED_PASSWORD || randomBytes(9).toString("base64url");
  let user;
  try {
    user = await auth.getUserByEmail(s.email);
    await auth.updateUser(user.uid, { password });
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    user = await auth.createUser({ email: s.email, password, displayName: s.displayName });
  }

  const claims = s.role === "admin"
    ? { role: "admin" }
    : { role: "officer", authorityId: s.authorityId, jurisdictionWards: wardsFor(s.authorityId) };
  await auth.setCustomUserClaims(user.uid, claims);

  const userDoc = {
    uid: user.uid,
    role: s.role,
    displayName: s.displayName,
    isAnonymous: false,
    email: s.email,
    languagePref: "en",
    fcmTokens: [],
  };
  if (s.role === "officer") {
    userDoc.authorityId = s.authorityId;
    userDoc.department = s.department;
    userDoc.jurisdictionWards = wardsFor(s.authorityId);
  }
  await upsert("users", user.uid, { ...userDoc, lastActiveAt: FieldValue.serverTimestamp() });

  return { role: s.role, email: s.email, password, authorityId: s.authorityId ?? null, uid: user.uid };
}

async function main() {
  console.log(`Seeding project ${projectId} …`);

  for (const c of SERVICE_CATALOG) await upsert("serviceCatalog", c.serviceCode, c);
  console.log(`  serviceCatalog: ${SERVICE_CATALOG.length} docs`);

  for (const a of AUTHORITIES) await upsert("authorities", a.authorityId, a);
  console.log(`  authorities: ${AUTHORITIES.length} docs`);

  const creds = [];
  for (const s of STAFF) creds.push(await ensureStaffUser(s));
  console.log(`  staff accounts: ${creds.length} (${creds.filter((c) => c.role === "officer").length} officers + admin)`);

  const out = join(dirname(fileURLToPath(import.meta.url)), "seed-output.local.json");
  writeFileSync(out, JSON.stringify({ projectId, seededAt: new Date().toISOString(), staff: creds }, null, 2));
  console.log(`  credentials → ${out} (gitignored)`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

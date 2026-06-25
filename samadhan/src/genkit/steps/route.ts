import "server-only";
import { getDb } from "@/lib/firebase-admin";
import type { Routing } from "@/genkit/schemas";

// Route step (backend-plan C6, standout #2). Rules-first and deterministic — NOT a Gemini
// call (the console badge says "Rules"). serviceCode → serviceCatalog.defaultAuthorityType
// + defaultDepartment → the single authority of that type in the issue's city. Ward is NOT
// used to select (all three seeded bodies share the same ward list, so type is the only
// real selector; data-shapes §4). Never throws: any read failure degrades to a best-effort
// match so issue creation/intake is never blocked.

// Mirror of the seed (scripts/seed.mjs): one authority per type in Bengaluru. Used only as
// a last-resort if the authorities query is unexpectedly empty.
const FALLBACK_AUTHORITY_BY_TYPE: Record<string, string> = {
  municipal_corporation: "bbmp",
  water_board: "bwssb",
  discom: "bescom",
  other: "bbmp",
};

type AuthorityType = Routing["authorityType"];

const AUTHORITY_TYPES: AuthorityType[] = [
  "municipal_corporation",
  "water_board",
  "discom",
  "other",
];

function asAuthorityType(v: unknown): AuthorityType {
  return AUTHORITY_TYPES.includes(v as AuthorityType)
    ? (v as AuthorityType)
    : "municipal_corporation";
}

export type RouteResult = {
  routing: Routing;
  authorityName: string; // → issue.agencyResponsible
  authorityShortName: string;
};

export async function route(input: {
  serviceCode: string;
  serviceName: string;
  city: string | null;
}): Promise<RouteResult> {
  const { serviceCode, serviceName, city } = input;
  const db = getDb();

  // 1. serviceCode → authorityType + default department (from serviceCatalog).
  let authorityType: AuthorityType = "municipal_corporation";
  let department = "General / Grievances";
  try {
    const catSnap = await db.collection("serviceCatalog").doc(serviceCode).get();
    const cat = catSnap.data() as
      | { defaultAuthorityType?: string; defaultDepartment?: string }
      | undefined;
    if (cat?.defaultAuthorityType) authorityType = asAuthorityType(cat.defaultAuthorityType);
    if (cat?.defaultDepartment) department = cat.defaultDepartment;
  } catch (err) {
    console.warn("[route] serviceCatalog read failed, using defaults", err);
  }

  // 2. authorityType (+ city when available) → the authority doc.
  let authorityId = FALLBACK_AUTHORITY_BY_TYPE[authorityType] ?? "bbmp";
  let authorityName = "";
  let shortName = authorityId.toUpperCase();
  let channel: Routing["channel"] = "app";
  let matched = false;
  try {
    const snap = await db.collection("authorities").where("type", "==", authorityType).get();
    if (!snap.empty) {
      // Prefer a city match; otherwise the single authority of that type.
      const doc =
        snap.docs.find((d) => (d.data().city as string | undefined) === city) ?? snap.docs[0];
      const d = doc.data() as {
        name?: string;
        shortName?: string;
        channels?: { app?: boolean; portalUrl?: string; email?: string };
      };
      authorityId = doc.id;
      authorityName = d.name ?? doc.id;
      shortName = d.shortName ?? doc.id.toUpperCase();
      channel = d.channels?.portalUrl ? "portal" : d.channels?.email ? "email" : "app";
      matched = true;
    }
  } catch (err) {
    console.warn("[route] authorities query failed, using fallback id", err);
  }

  const where = city ? `for ${city}` : "for this area";
  const reasoning = `${serviceName} is handled by ${shortName}'s ${department} ${where}.`;

  return {
    routing: {
      authorityType,
      authorityId,
      department,
      channel,
      confidence: matched ? 1 : 0.6,
      reasoning,
    },
    authorityName: authorityName || shortName,
    authorityShortName: shortName,
  };
}

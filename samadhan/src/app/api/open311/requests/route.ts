import { getDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open311 GeoReport v2 export (backend-plan C14.1, data-shapes §11). Maps our public
// `issues` → the GeoReport v2 `service_requests` representation so the dataset is
// interoperable with any Open311 client. Public, no auth (like /api/stats).
//
// Bindings (wiki.open311.org/GeoReport_v2 · GET service_requests):
//   - JSON form is a TOP-LEVEL ARRAY of service_request objects (spec-correct; not wrapped).
//   - XML form is <service_requests><request>…</request></service_requests>.
//   - status ∈ {open, closed}; verified_resolved / cannot_fix → closed, else open (§11).
//   - *_datetime fields are ISO-8601.
//   - The response address field is `address` (data-shapes §11's `address_string` is the
//     POST-create input name; the GET response element is `address`).
// Filters (spec-supported, applied in code so no composite index is needed):
//   ?status=open|closed   ?service_code=<code>   ?format=xml

const SCAN_LIMIT = 1000;
const CLOSED_STATUSES = new Set(["verified_resolved", "cannot_fix"]);

type Ts = { toDate(): Date } | null | undefined;

type IssueData = {
  id?: string;
  status?: string;
  statusNotes?: string;
  serviceCode?: string;
  serviceName?: string;
  description?: string;
  agencyResponsible?: string;
  addressString?: string;
  zipcode?: string | null;
  location?: { latitude: number; longitude: number };
  beforeMedia?: { downloadUrl?: string };
  sla?: { deadline?: Ts };
  createdAt?: Ts;
  updatedAt?: Ts;
};

// One GeoReport v2 service_request (field order mirrors the spec representation).
type ServiceRequest = {
  service_request_id: string;
  status: "open" | "closed";
  status_notes?: string;
  service_name?: string;
  service_code?: string;
  description?: string;
  agency_responsible?: string;
  requested_datetime?: string;
  updated_datetime?: string;
  expected_datetime?: string;
  address?: string;
  zipcode?: string;
  lat?: number;
  long?: number;
  media_url?: string;
};

const iso = (t: Ts): string | undefined => {
  try {
    return t ? t.toDate().toISOString() : undefined;
  } catch {
    return undefined;
  }
};

function toServiceRequest(id: string, d: IssueData): ServiceRequest {
  const status: "open" | "closed" = CLOSED_STATUSES.has(d.status ?? "") ? "closed" : "open";
  const sr: ServiceRequest = { service_request_id: id, status };
  if (d.statusNotes) sr.status_notes = d.statusNotes;
  if (d.serviceName) sr.service_name = d.serviceName;
  if (d.serviceCode) sr.service_code = d.serviceCode;
  if (d.description) sr.description = d.description;
  if (d.agencyResponsible) sr.agency_responsible = d.agencyResponsible;
  const req = iso(d.createdAt);
  const upd = iso(d.updatedAt);
  const exp = iso(d.sla?.deadline);
  if (req) sr.requested_datetime = req;
  if (upd) sr.updated_datetime = upd;
  if (exp) sr.expected_datetime = exp;
  if (d.addressString) sr.address = d.addressString;
  if (d.zipcode) sr.zipcode = d.zipcode;
  if (typeof d.location?.latitude === "number") sr.lat = d.location.latitude;
  if (typeof d.location?.longitude === "number") sr.long = d.location.longitude;
  if (d.beforeMedia?.downloadUrl) sr.media_url = d.beforeMedia.downloadUrl;
  return sr;
}

const xmlEscape = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function toXml(requests: ServiceRequest[]): string {
  const rows = requests
    .map((r) => {
      const fields = Object.entries(r)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `    <${k}>${xmlEscape(String(v))}</${k}>`)
        .join("\n");
      return `  <request>\n${fields}\n  </request>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<service_requests>\n${rows}\n</service_requests>\n`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format");
    const statusFilter = url.searchParams.get("status"); // open | closed
    const codeFilter = url.searchParams.get("service_code");

    const db = getDb();
    const snap = await db
      .collection("issues")
      .where("isPublic", "==", true)
      .limit(SCAN_LIMIT)
      .get();

    let requests = snap.docs.map((doc) => toServiceRequest(doc.id, doc.data() as IssueData));
    if (statusFilter === "open" || statusFilter === "closed") {
      requests = requests.filter((r) => r.status === statusFilter);
    }
    if (codeFilter) {
      requests = requests.filter((r) => r.service_code === codeFilter);
    }

    if (format === "xml") {
      return new Response(toXml(requests), {
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      });
    }
    // GeoReport v2 JSON = a top-level array of service_request objects.
    return Response.json(requests);
  } catch (err) {
    console.error("[open311] failed", err);
    return Response.json({ error: "OPEN311_EXPORT_FAILED" }, { status: 500 });
  }
}

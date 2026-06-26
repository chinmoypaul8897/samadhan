import { getDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public geo points (backend-plan C11.2) — for the dashboard Maps heatmap. Lean DTO of public
// issues only; no auth (public issues are publicly readable). Server-shaped so we never ship
// full issue docs to the client.

const SCAN_LIMIT = 500;

type IssueData = {
  status?: string;
  severity?: string;
  group?: string;
  serviceCode?: string;
  trackingId?: string;
  title?: string;
  location?: { latitude: number; longitude: number };
};

export async function GET() {
  try {
    const db = getDb();
    const snap = await db.collection("issues").where("isPublic", "==", true).limit(SCAN_LIMIT).get();

    const points = snap.docs
      .map((doc) => {
        const d = doc.data() as IssueData;
        if (!d.location) return null;
        return {
          lat: d.location.latitude,
          lng: d.location.longitude,
          severity: d.severity ?? "medium",
          status: d.status ?? "submitted",
          group: d.group ?? "other",
          serviceCode: d.serviceCode ?? "other",
          trackingId: d.trackingId ?? "",
          title: d.title ?? "",
        };
      })
      .filter(Boolean);

    return Response.json({ ok: true, points });
  } catch (err) {
    console.error("[issues/geo] failed", err);
    return Response.json({ ok: false, error: "GEO_FAILED" }, { status: 500 });
  }
}

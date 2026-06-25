import { adminHealth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Liveness + Firebase Admin init check (C0 gate).
export function GET() {
  const { adminReady, projectId } = adminHealth();
  return Response.json({
    ok: true,
    service: "samadhan",
    projectId,
    adminReady,
  });
}

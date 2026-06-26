import { OAuth2Client } from "google-auth-library";
import { runSweep } from "@/lib/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // the sweep makes per-issue Gemini calls

// SLA-sweep trigger (backend-plan C10). The service is public (citizens use it), so this
// endpoint authenticates the caller itself. Two accepted paths:
//  (A) OIDC — a Cloud Scheduler → Cloud Run token: verify the Bearer ID token, require its
//      audience === SERVICE_URL and email === SCHEDULER_SA_EMAIL (the Google-native path).
//  (B) Shared secret — an X-Sweep-Token header matching SLA_SWEEP_TOKEN. Lets the cron run
//      with no IAM grants (Scheduler --headers) and lets us trigger the sweep for tests/demo.
// Neither → 401, no work. Bindings: cloud.google.com/run/docs/triggering/using-scheduler;
// google-auth-library OAuth2Client.verifyIdToken.

const SERVICE_URL = process.env.SERVICE_URL || process.env.NEXT_PUBLIC_APP_ORIGIN;
const SCHEDULER_SA_EMAIL = process.env.SCHEDULER_SA_EMAIL;
const SLA_SWEEP_TOKEN = process.env.SLA_SWEEP_TOKEN;

const oauth = new OAuth2Client();

async function authorized(req: Request): Promise<boolean> {
  // (B) shared secret — constant work, no network.
  const headerToken = req.headers.get("x-sweep-token");
  if (SLA_SWEEP_TOKEN && headerToken && headerToken === SLA_SWEEP_TOKEN) return true;

  // (A) OIDC bearer token from Cloud Scheduler.
  const auth = req.headers.get("authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m && SERVICE_URL && SCHEDULER_SA_EMAIL) {
    try {
      const ticket = await oauth.verifyIdToken({ idToken: m[1].trim(), audience: SERVICE_URL });
      const payload = ticket.getPayload();
      if (payload?.email === SCHEDULER_SA_EMAIL && payload.email_verified) return true;
    } catch {
      // fall through to 401
    }
  }
  return false;
}

export async function POST(req: Request) {
  if (!(await authorized(req))) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  try {
    const summary = await runSweep();
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[sla-sweep] failed", err);
    return Response.json({ ok: false, error: "SWEEP_FAILED" }, { status: 500 });
  }
}

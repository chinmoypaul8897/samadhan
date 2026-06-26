import { appRoute } from "@genkit-ai/next";
import { intakeFlow } from "@/genkit/flows/intake";
import { allow, callerKey } from "@/lib/ratelimit";
import { fail } from "@/lib/http";

// The Genkit intake pipeline, exposed at /api/intake (replaces the C2 stub).
// appRoute reads `const { data: input } = await req.json()` → the frozen client
// contract { data: { reportId } } is exactly right. Node runtime (Admin SDK + Genkit).
//
// C12: a lenient per-instance IP rate-limit guards the Gemini free tier against runaway loops
// / accidental spam (the kick is unauthenticated by design — only the report's creator knows
// its reportId). Over the limit → 429 RATE_LIMITED; otherwise the request passes through to
// the unchanged flow. 12 kicks / minute is far above any real demo cadence.
export const runtime = "nodejs";

const flow = appRoute(intakeFlow);
const LIMIT = 12;
const WINDOW_MS = 60_000;

export async function POST(req: Request): Promise<Response> {
  if (!allow(`intake:${callerKey(req)}`, LIMIT, WINDOW_MS)) return fail("RATE_LIMITED");
  return flow(req as Parameters<typeof flow>[0]);
}

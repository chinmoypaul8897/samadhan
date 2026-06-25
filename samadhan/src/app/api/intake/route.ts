import { appRoute } from "@genkit-ai/next";
import { intakeFlow } from "@/genkit/flows/intake";

// The Genkit intake pipeline, exposed at /api/intake (replaces the C2 stub).
// appRoute reads `const { data: input } = await req.json()` → the frozen client
// contract { data: { reportId } } is exactly right. Node runtime (Admin SDK + Genkit).
export const POST = appRoute(intakeFlow);

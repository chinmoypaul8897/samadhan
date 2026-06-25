import "server-only";
import { genkit, z } from "genkit";
import { vertexAI } from "@genkit-ai/google-genai";

// The agent engine (server-only). We use Vertex AI (ADC) rather than the Gemini
// Developer API key path: same gemini-2.5-flash, no API key/Secret to manage, and
// it works in asia-south1 today (the Developer API on this project is billing-gated).
// Bills the project pay-as-you-go — pennies at demo volume, under the ₹400 budget.
const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const LOCATION = process.env.VERTEX_LOCATION || "asia-south1";

export const ai = genkit({
  plugins: [vertexAI({ location: LOCATION, projectId: PROJECT_ID })],
});

export const MODEL = vertexAI.model("gemini-2.5-flash");

export { z };

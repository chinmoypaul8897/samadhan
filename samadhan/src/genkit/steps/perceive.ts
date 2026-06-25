import "server-only";
import { ai, MODEL } from "@/genkit/index";
import { PerceiveOutput } from "@/genkit/schemas";
import { withRetry } from "@/lib/retry";
import { getBucket, getDb } from "@/lib/firebase-admin";

// Re-encode only if the stored image is large or not already a web-safe JPEG (the
// C2 client downscales to ~1280px JPEG; this is the HEIC/oversized safety net).
const REENCODE_OVER_BYTES = 2 * 1024 * 1024;

type Catalogue = { codes: Set<string>; names: Map<string, string> };

async function loadCatalogue(): Promise<Catalogue> {
  const snap = await getDb().collection("serviceCatalog").get();
  const codes = new Set<string>();
  const names = new Map<string, string>();
  snap.forEach((d) => {
    codes.add(d.id);
    names.set(d.id, (d.data().serviceName as string) ?? d.id);
  });
  return { codes, names };
}

async function imageDataUrl(path: string): Promise<string> {
  const [buf] = await getBucket().file(path).download();
  let bytes = buf;
  if (buf.length > REENCODE_OVER_BYTES) {
    // Lazy-load sharp only for the rare large/HEIC case. Its native libvips binary
    // doesn't load in the Cloud Run standalone image, so on failure (or anywhere it
    // can't load) we fall back to the original bytes — Gemini accepts up to 20MB
    // inline and the C2 client already downscales the common path to ~1280px.
    try {
      const sharp = (await import("sharp")).default;
      bytes = await sharp(buf)
        .rotate()
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch {
      bytes = buf;
    }
  }
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

function buildPrompt(codes: string[], rawText?: string): string {
  return [
    "You are the Perceive step of a civic-issue resolution agent in Bengaluru, India.",
    "Look at the citizen's photo and classify the civic issue for an Open311-style report.",
    "",
    "serviceCode MUST be exactly one of these catalogue codes (lowercase):",
    codes.join(", ") + ".",
    "If the photo shows a civic issue that fits none of these, use 'other'.",
    "",
    "Rules:",
    "- isCivicIssue: true only for a real public-infrastructure / civic problem (roads, water, sanitation, electricity, streetlight, drainage, garbage, etc.). For selfies, food, indoor scenes, memes, screenshots, random objects → false.",
    "- confidence: 0..1, your confidence in isCivicIssue + serviceCode.",
    "- severity: 'low' (cosmetic/minor) | 'medium' (clear problem, not dangerous) | 'high' (blocks use, large, or worsening).",
    "- hazard: true only if it is an immediate safety danger (open manhole, live wire, deep flooding, collapse).",
    "- caption: one factual sentence describing exactly what is visible.",
    "- ocrText: any readable sign/landmark/board text in the image, else null.",
    "- suggestedTitle: a short citizen-facing title (≤ 8 words).",
    "- tags: 2-5 lowercase keywords.",
    "- languageDetected: ISO 639-1 of any text in the image or the note (default 'en').",
    "- reasoning: one short sentence on why.",
    rawText ? `\nThe citizen also typed: "${rawText}"` : "",
  ].join("\n");
}

// Returns the validated analysis, or null if the model couldn't conform after retries.
export async function perceive(input: {
  mediaPath: string;
  rawText?: string;
}): Promise<PerceiveOutput | null> {
  const { codes, names } = await loadCatalogue();
  const url = await imageDataUrl(input.mediaPath);

  const output = await withRetry(async () => {
    const res = await ai.generate({
      model: MODEL,
      prompt: [{ media: { url } }, { text: buildPrompt([...codes].sort(), input.rawText) }],
      output: { schema: PerceiveOutput },
    });
    return res.output;
  });

  if (!output) return null;

  // Enforce catalogue membership in code (the schema keeps serviceCode permissive so
  // a hallucinated code coerces to 'other' rather than nulling the whole result).
  if (!codes.has(output.serviceCode)) {
    output.serviceCode = "other";
  }
  output.serviceName = names.get(output.serviceCode) ?? output.serviceName;
  return output;
}

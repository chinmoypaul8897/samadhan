import "server-only";
import { ai, MODEL } from "@/genkit/index";
import { ActDraft, type Filing } from "@/genkit/schemas";
import { withRetry } from "@/lib/retry";

// Act step (backend-plan C6, standout #2). Gemini drafts a formal, ready-to-file civic
// complaint addressed to the routed authority/department, in the citizen's detected
// language. Returns a Filing at status 'prepared' (NEVER 'submitted' — submission is the
// citizen's one-tap consent at /api/issues/[id]/file). Null after retries → the flow marks
// the act step 'error' and leaves filing at 'draft' (no auto-submit, no dead end).

export type ActInput = {
  serviceName: string;
  severity: string;
  hazard: boolean;
  title: string;
  description: string;
  addressString: string;
  ward: string | null;
  trackingId: string;
  languageDetected: string;
  authorityName: string;
  authorityShortName: string;
  department: string;
  format: string;
};

function actPrompt(i: ActInput): string {
  const langName = i.languageDetected === "hi" ? "Hindi (हिन्दी)" : "English";
  const location = [i.addressString, i.ward].filter(Boolean).join(", ");
  return [
    `You are a civic-affairs assistant drafting a FORMAL complaint on behalf of a citizen of Bengaluru, India.`,
    `Write the complaint in ${langName}.`,
    ``,
    `Address it to: The ${i.department}, ${i.authorityName} (${i.authorityShortName}).`,
    `Issue category: ${i.serviceName}${i.hazard ? " (SAFETY HAZARD)" : ""}, severity: ${i.severity}.`,
    `Title: ${i.title}`,
    `Description: ${i.description}`,
    `Location: ${location || "as per the attached report"}.`,
    `Reference (Samadhan tracking ID): ${i.trackingId}.`,
    ``,
    `Requirements for the complaintText:`,
    `- A proper formal complaint: a subject line, a salutation to the department, body paragraphs, and a courteous closing.`,
    `- State the problem, its location, and why it needs attention (cite the hazard/severity).`,
    `- Request resolution within the statutory citizen-charter timeframe for this category.`,
    `- Cite the tracking ID as the reference.`,
    `- Close as a complaint filed via the Samadhan civic platform on behalf of a resident.`,
    `- Do NOT invent officer names, phone numbers, case numbers, or signatures. Use only the facts given.`,
    `- Keep it concise (roughly 130–200 words), ready to file as-is.`,
    ``,
    `Return complaintText (the full complaint) and language (the ISO 639-1 code you wrote in, e.g. "en" or "hi").`,
  ].join("\n");
}

export async function act(input: ActInput): Promise<Filing | null> {
  const draft = await withRetry(async () => {
    const res = await ai.generate({
      model: MODEL,
      prompt: actPrompt(input),
      output: { schema: ActDraft },
    });
    return res.output;
  });

  if (!draft || !draft.complaintText) return null;

  return {
    status: "prepared",
    complaintText: draft.complaintText,
    language: draft.language || input.languageDetected,
    format: input.format,
    externalRef: null,
  };
}

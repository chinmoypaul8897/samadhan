import "server-only";
import { ai, MODEL } from "@/genkit/index";
import { TranscribeOutput } from "@/genkit/schemas";
import { withRetry } from "@/lib/retry";
import { getBucket } from "@/lib/firebase-admin";

// Voice transcription sub-step (backend-plan C13.1, data-shapes §7). The citizen's voice note
// is transcribed by Gemini (multimodal audio on the existing Vertex path — no Cloud Speech-to-
// Text API, no encoding pitfalls) verbatim + language-detected. The transcript is fed into
// Perceive as rawText (→ classification + languageDetected → Act drafts the complaint in Hindi).
// Best-effort: voice is optional, so any failure returns null and the photo-only path proceeds.

const TRANSCRIBE_PROMPT = [
  "You are the transcription sub-step of a civic-issue resolution agent in Bengaluru, India.",
  "Transcribe the citizen's voice note VERBATIM. It may be English, Hindi, or Hinglish.",
  "Return:",
  "- transcript: the spoken words as text, in the original language/script (Devanagari for Hindi).",
  "- language: ISO 639-1 of the dominant spoken language ('en' or 'hi'; default 'en').",
  "If there is no intelligible speech, return an empty transcript and 'en'.",
].join("\n");

export async function transcribe(
  voicePath: string,
): Promise<{ transcript: string; language: string } | null> {
  try {
    const [buf] = await getBucket().file(voicePath).download();
    const url = `data:audio/webm;base64,${buf.toString("base64")}`;
    const out = await withRetry(async () => {
      const res = await ai.generate({
        model: MODEL,
        prompt: [{ media: { url } }, { text: TRANSCRIBE_PROMPT }],
        output: { schema: TranscribeOutput },
      });
      return res.output;
    });
    if (!out || !out.transcript.trim()) return null;
    return { transcript: out.transcript.trim(), language: out.language || "en" };
  } catch (err) {
    console.error("[transcribe] failed", err);
    return null;
  }
}

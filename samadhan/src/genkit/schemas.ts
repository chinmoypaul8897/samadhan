import { z } from "genkit";

// Perceive → report.analysis (data-shapes §8.1). Flat object, enums + .optional()/
// .nullable() only — NO z.union (anyOf is the fragile spot for Gemini constrained
// generation). serviceCode is z.string() (membership enforced in code, not schema,
// so a hallucinated code coerces to 'other' instead of nulling the whole output).
export const PerceiveOutput = z.object({
  isCivicIssue: z.boolean(),
  confidence: z.number(),
  serviceCode: z.string(),
  serviceName: z.string(),
  subCategory: z.string().optional(),
  severity: z.enum(["low", "medium", "high"]),
  hazard: z.boolean(),
  caption: z.string(),
  ocrText: z.string().nullable(),
  suggestedTitle: z.string(),
  tags: z.array(z.string()),
  languageDetected: z.string(),
  reasoning: z.string(),
});

export type PerceiveOutput = z.infer<typeof PerceiveOutput>;

// Dedup → report.dedup (data-shapes §8.2). Gemini compares the new report photo to a
// nearby same-category issue's photo and decides if they're the SAME physical problem
// (same pothole/pile/pole), not merely the same category. Flat object, no z.union.
export const DedupVerdict = z.object({
  sameIssue: z.boolean(),
  confidence: z.number(),
  reasoning: z.string(),
});

export type DedupVerdict = z.infer<typeof DedupVerdict>;

// Route → issue.routing (data-shapes §8.3). NOT a Gemini output — routing is a
// deterministic rules lookup (serviceCode → defaultAuthorityType → the single authority
// of that type in the city). This schema is the persisted/typed mirror, built in code.
export const Routing = z.object({
  authorityType: z.enum(["municipal_corporation", "water_board", "discom", "other"]),
  authorityId: z.string(),
  department: z.string(),
  channel: z.enum(["app", "email", "portal", "phone", "whatsapp", "social"]),
  confidence: z.number(),
  reasoning: z.string(),
});

export type Routing = z.infer<typeof Routing>;

// Act → the Gemini-generated part of issue.filing (data-shapes §8.4). The model drafts
// the formal complaint text in the detected language; everything else (status, format,
// externalRef, submittedAt, consentByUid) is set in code so the model can never
// auto-submit. Flat object, no z.union — same constrained-generation discipline.
export const ActDraft = z.object({
  complaintText: z.string(),
  language: z.string(),
});

export type ActDraft = z.infer<typeof ActDraft>;

// The persisted issue.filing shape (data-shapes §8.4). `prepared` after Act drafts it;
// flipped to `submitted` by the one-tap /api/issues/[id]/file consent gate (which also
// sets submittedAt + consentByUid — Timestamp/uid set server-side, not by the model).
export const Filing = z.object({
  status: z.enum(["draft", "prepared", "submitted", "failed"]),
  complaintText: z.string(),
  language: z.string(),
  format: z.string(),
  externalRef: z.string().nullable(),
});

export type Filing = z.infer<typeof Filing>;

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

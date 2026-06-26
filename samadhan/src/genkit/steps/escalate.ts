import "server-only";
import { ai, MODEL } from "@/genkit/index";
import { EscalateDraft } from "@/genkit/schemas";
import { withRetry } from "@/lib/retry";

// Escalate step (backend-plan C10, standout #3). On an SLA breach the agent autonomously
// drafts the NEXT escalation rung — a firm reminder, then a higher-authority appeal, then a
// formal RTI application. Gemini drafts ONLY the text (mirrors act.ts); the rung's type /
// target / channel are decided in code from the breach level + the authority's escalation
// ladder, so the agent never fabricates a name or handle (seed has titles only).

export type EscalationType = "reminder" | "higher_authority_appeal" | "rti_draft" | "social_post";

type AuthorityLike = {
  name: string;
  shortName: string;
  escalationContacts?: { level: number; title: string }[];
};

/** Rung type by breach level (1 → reminder, 2 → appeal, 3 → RTI). */
export function rungType(level: number): EscalationType {
  if (level <= 1) return "reminder";
  if (level === 2) return "higher_authority_appeal";
  return "rti_draft";
}

/** The honest addressee for a rung — titles only, never a fabricated name/handle. */
export function rungTarget(level: number, authority: AuthorityLike): string {
  if (level <= 1) return `Grievance Cell, ${authority.shortName}`;
  if (level === 2) {
    const c = authority.escalationContacts?.find((e) => e.level === 2);
    return `${c?.title ?? "Zonal/Executive Engineer"}, ${authority.shortName}`;
  }
  return `Public Information Officer (PIO), ${authority.name}`;
}

export type EscalateInput = {
  level: number; // the rung being drafted (1..3)
  type: EscalationType;
  target: string;
  serviceName: string;
  severity: string;
  hazard: boolean;
  title: string;
  description: string;
  addressString: string;
  ward: string | null;
  trackingId: string;
  language: string; // 'en' | 'hi'
  authorityName: string;
  authorityShortName: string;
  breachedByHours: number;
  slaHours: number;
};

function escalatePrompt(i: EscalateInput): string {
  const langName = i.language === "hi" ? "Hindi (हिन्दी)" : "English";
  const location = [i.addressString, i.ward].filter(Boolean).join(", ");
  const common = [
    `Write in ${langName}.`,
    `Addressee: ${i.target}.`,
    `Issue: ${i.serviceName}${i.hazard ? " (SAFETY HAZARD)" : ""}, severity ${i.severity}.`,
    `Title: ${i.title}`,
    `Description: ${i.description}`,
    `Location: ${location || "as per the filed report"}.`,
    `Samadhan tracking ID: ${i.trackingId}.`,
    `The citizen-charter resolution window of about ${i.slaHours} hours has lapsed; the complaint is overdue by roughly ${Math.round(i.breachedByHours)} hours with no resolution.`,
    `Use ONLY the facts above. Do NOT invent officer names, phone numbers, case numbers, dates, or signatures.`,
  ];

  if (i.type === "reminder") {
    return [
      `You are a civic-affairs assistant drafting a firm but courteous REMINDER on behalf of a Bengaluru citizen, because the authority has missed its service deadline.`,
      ...common,
      ``,
      `Draft a short reminder (about 90–140 words): subject line, salutation to the Grievance Cell, state that the SLA has lapsed, request immediate action and a status update, reference the tracking ID, courteous close as filed via the Samadhan civic platform.`,
      `Return content (the full reminder) and reasoning (one sentence on why this rung).`,
    ].join("\n");
  }

  if (i.type === "higher_authority_appeal") {
    return [
      `You are a civic-affairs assistant drafting a formal APPEAL to a higher authority on behalf of a Bengaluru citizen, because an earlier complaint and reminder went unaddressed past the deadline.`,
      ...common,
      ``,
      `Draft a formal appeal (about 130–190 words) addressed to the ${i.target}: subject line, respectful salutation, note that the matter was already reported and reminded but remains unresolved beyond the charter timeframe, request the officer's intervention and a definite timeline, reference the tracking ID, courteous close as filed via the Samadhan civic platform.`,
      `Return content (the full appeal) and reasoning (one sentence on why this rung).`,
    ].join("\n");
  }

  // rti_draft
  return [
    `You are a civic-affairs assistant drafting a formal application under the Right to Information Act, 2005, on behalf of a Bengaluru citizen, because repeated complaints and appeals have failed past the service deadline.`,
    ...common,
    ``,
    `Draft a proper RTI application (about 160–230 words) addressed to the Public Information Officer: a subject line referencing the RTI Act 2005, a salutation, a brief background of the unresolved complaint and the lapsed charter timeframe, then a NUMBERED list of specific information requested — (1) the action-taken report on this complaint, (2) the designations of the officials responsible for this jurisdiction, (3) the reasons for the delay beyond the statutory timeframe, (4) the expected date of resolution. Mention the prescribed RTI fee will be paid as applicable and that a response is sought within the 30-day statutory period. Reference the tracking ID. Courteous close as filed via the Samadhan civic platform.`,
    `Return content (the full RTI application) and reasoning (one sentence on why this rung).`,
  ].join("\n");
}

/** Draft the escalation text for a rung. Null after retries → caller skips this escalation. */
export async function escalate(input: EscalateInput): Promise<EscalateDraft | null> {
  return withRetry(async () => {
    const res = await ai.generate({
      model: MODEL,
      prompt: escalatePrompt(input),
      output: { schema: EscalateDraft },
    });
    return res.output;
  });
}

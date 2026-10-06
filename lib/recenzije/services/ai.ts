import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env, integrations } from "@/lib/recenzije/env";

/**
 * Claude service layer. All calls are server-side; the API key never reaches the
 * browser. When ANTHROPIC_API_KEY is missing, callers get AiNotConfiguredError
 * and the UI shows setup instructions — no canned "AI" output.
 */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI nije postavljen. Dodajte ANTHROPIC_API_KEY u Vercel env varijable.");
  }
}

let client: Anthropic | null = null;
function anthropic() {
  if (!integrations.ai()) throw new AiNotConfiguredError();
  client ??= new Anthropic({ apiKey: env.anthropicKey });
  return client;
}

async function complete(system: string, prompt: string, maxTokens = 800): Promise<string> {
  const res = await anthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

function parseJsonArray(text: string): string[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("AI je vratio neočekivan format. Pokušajte ponovno.");
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error("AI je vratio neočekivan format. Pokušajte ponovno.");
  return arr.map(String).filter(Boolean);
}

const SMS_RULES = `Rules:
- Write SMS text only, no greetings like "Subject:".
- Keep each message under 300 characters.
- Must contain the literal placeholder {review_link} exactly once (it is replaced with a tracking link).
- You may use these placeholders: {first_name}, {business_name}, {service}, {technician}, {service_date}.
- Sound like a real local business owner: warm, specific, never pushy, no emojis overload (max one), no ALL CAPS.
- Never offer incentives for reviews and never ask only for positive reviews (Google policy).
- Write in the requested language.
- If the language is Croatian (or any language with č, ć, š, ž, đ): write WITHOUT diacritics (c, s, z, dj) so the SMS stays in the cheap GSM-7 encoding. Natural Croatian, informal "Bok" greeting is fine, address the client politely (Vi form, lowercase "vi" is fine in SMS).`;

export type SmsVariantInput = {
  businessName: string;
  industry?: string | null;
  kind: "request" | "follow_up";
  tone: "friendly" | "professional" | "short";
  language: string;
  clientFirstName?: string;
  service?: string | null;
  technician?: string | null;
  previousInteractions?: string;
  instructions?: string;
};

export async function generateSmsVariants(input: SmsVariantInput, count = 3): Promise<string[]> {
  const system = `You write SMS review requests for local service businesses.\n${SMS_RULES}`;
  const prompt = `Business: ${input.businessName}${input.industry ? ` (${input.industry})` : ""}
Message type: ${input.kind === "request" ? "first review request right after the job" : "polite follow-up to someone who has not reviewed yet"}
Tone: ${input.tone}
Language: ${input.language}
${input.clientFirstName ? `Client first name (for context only, still use {first_name}): ${input.clientFirstName}` : ""}
${input.service ? `Service performed: ${input.service}` : ""}
${input.technician ? `Technician: ${input.technician}` : ""}
${input.previousInteractions ? `Previous interactions: ${input.previousInteractions}` : ""}
${input.instructions ? `Extra instructions from the owner: ${input.instructions}` : ""}

Return a JSON array of ${count} distinct message templates and nothing else.`;
  const variants = parseJsonArray(await complete(system, prompt));
  return variants.map((v) => (v.includes("{review_link}") ? v : `${v} {review_link}`)).slice(0, count);
}

export async function summarizeReviews(
  reviews: { rating: number; comment: string | null; reviewerName: string }[],
  language = "Croatian"
): Promise<string> {
  if (reviews.length === 0) return "Još nema recenzija za sažetak.";
  const lines = reviews
    .slice(0, 80)
    .map((r) => `- ${r.rating}★ ${r.comment ? r.comment.replace(/\s+/g, " ").slice(0, 400) : "(no text)"}`)
    .join("\n");
  return complete(
    `You analyze customer reviews for a local business owner. Be concise and concrete. Use short bullet points. Answer in ${language}.`,
    `Summarize these reviews in three sections titled "Što klijenti vole", "Što poboljšati", "Riječi koje se ponavljaju". Max 120 words total.\n\n${lines}`,
    500
  );
}

export async function analyzePerformance(stats: Record<string, number | string>, language = "Croatian"): Promise<string> {
  return complete(
    `You are a growth advisor for a local service business that asks customers for Google reviews by SMS. Give 3-5 specific, actionable optimizations as short bullet points. Base every point on the numbers given; don't invent data. Answer in ${language}.`,
    `Review funnel and messaging stats for the last 30 days:\n${Object.entries(stats)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")}`,
    500
  );
}

export async function suggestReply(review: { rating: number; comment: string | null; reviewerName: string }, businessName: string) {
  return complete(
    `You write short, sincere public replies from a local business owner to Google reviews. 2-3 sentences. Match the review's language. Never argue; for negative reviews apologise and invite them to get in touch.`,
    `Business: ${businessName}\nReviewer: ${review.reviewerName}\nRating: ${review.rating}/5\nReview: ${review.comment || "(no text)"}`,
    300
  );
}

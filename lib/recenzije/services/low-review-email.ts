import { escapeHtml } from "@/lib/recenzije/utils";

/**
 * Čiste funkcije za e-mail "Upozorenje na lošu recenziju": pravila podobnosti i sastavljanje poruke.
 * Namjerno bez "server-only" i bez baze (kao weekly-report-email.ts), da se mogu provjeriti jediničnim testom.
 * Tekst recenzije i ime recenzenta su tuđi, nepouzdani unos: u HTML-u prolaze kroz escapeHtml, u predmet ne ulaze nikako.
 */

/** Najviša ocjena koja pokreće upozorenje (1, 2 ili 3 zvjezdice). */
export const LOW_REVIEW_MAX_RATING = 3;
/**
 * Upozorenje se šalje samo za recenzije koje je Google objavio u zadnjih 14 dana. Time prvo povezivanje (ili prvi
 * uvoz) ne zasipa vlasnika starim recenzijama, a recenzija koja zbog greške slanja ostane neobrađena ne stiže mjesecima kasnije.
 */
export const LOW_REVIEW_WINDOW_DAYS = 14;

export function isLowRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= LOW_REVIEW_MAX_RATING;
}

export function isRecentReview(reviewedAt: Date, now: Date = new Date()): boolean {
  const age = now.getTime() - reviewedAt.getTime();
  // Recenzija "iz budućnosti" (neispravan sat ili krivi datum) ne smije pokretati upozorenje.
  return age >= -5 * 60_000 && age <= LOW_REVIEW_WINDOW_DAYS * 86_400_000;
}

const EMAIL_RE = /^[^\s@<>"',;]{1,64}@[^\s@<>"',;]{1,190}\.[^\s@<>"',;]{2,}$/;
export function validAlertEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  return v.length <= 254 && EMAIL_RE.test(v) ? v : null;
}

/** Ima li smisla slati upozorenje za ovu recenziju (sva pravila na jednom mjestu). */
export function alertEligibility(input: {
  rating: number;
  reviewedAt: Date;
  isDemo: boolean;
  lowReviewAlerts: boolean;
  contactEmail: string | null | undefined;
  now?: Date;
}): { ok: true; email: string } | { ok: false; reason: "rating" | "old" | "demo" | "switch_off" | "no_email" } {
  if (!isLowRating(input.rating)) return { ok: false, reason: "rating" };
  if (input.isDemo) return { ok: false, reason: "demo" };
  if (!input.lowReviewAlerts) return { ok: false, reason: "switch_off" };
  const email = validAlertEmail(input.contactEmail);
  if (!email) return { ok: false, reason: "no_email" };
  if (!isRecentReview(input.reviewedAt, input.now)) return { ok: false, reason: "old" };
  return { ok: true, email };
}

/** Jedan redak bez kontrolnih znakova i viška razmaka, skraćen. */
export function oneLine(s: string, max: number): string {
  const t = s.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Zadani, pristojan prijedlog odgovora kad AI nije postavljen ili nije uspio. */
export const GENERIC_REPLY =
  "Hvala Vam što ste izdvojili vrijeme i napisali nam ovo. Žao nam je što posjet nije bio onakav kakav bismo željeli. Rado bismo čuli više i ispravili što je pošlo po zlu, pa Vas molimo da nas kontaktirate izravno. Nadamo se da ćemo Vam drugom prilikom pokazati bolju stranu našeg lokala.";

/** Prijedlog odgovora iz AI-ja je tuđi tekst (model): bez oznaka, kontrolnih znakova i predugog sadržaja. */
export function cleanSuggestedReply(raw: string): string {
  return oneLine(raw.replace(/[<>]/g, ""), 700);
}

export type LowReviewMailInput = {
  orgName: string;
  recipientName: string | null;
  reviewerName: string;
  rating: number;
  comment: string | null;
  reviewedAt: Date;
  timezone: string;
  /** Poveznica na kojoj vlasnik odgovara na recenziju (Google). */
  replyUrl: string;
  /** Prijedlog odgovora; null = zadani tekst. */
  suggestedReply: string | null;
  /** True kad je prijedlog napisao AI (tekst "nacrt"). */
  aiDrafted: boolean;
  /** Gdje se upozorenje isključuje (Postavke). */
  settingsUrl: string;
  contactEmail: string;
};

function safeTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("hr-HR", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/Zagreb";
  }
}

export function buildLowReviewEmail(input: LowReviewMailInput): { subject: string; html: string; text: string } {
  const tz = safeTimeZone(input.timezone);
  const orgName = oneLine(input.orgName, 120) || "vaša tvrtka";
  const firstName = oneLine(input.recipientName ?? "", 60).split(" ")[0] ?? "";
  const reviewer = oneLine(input.reviewerName, 60) || "Google korisnik";
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));
  const comment = input.comment ? oneLine(input.comment, 400) : "";
  const when = input.reviewedAt.toLocaleDateString("hr-HR", { day: "numeric", month: "numeric", year: "numeric", timeZone: tz });
  const reply = cleanSuggestedReply(input.suggestedReply ?? "") || GENERIC_REPLY;
  const replyLabel = input.suggestedReply && input.aiDrafted ? "Prijedlog odgovora (AI nacrt, provjerite prije objave)" : "Prijedlog odgovora (prilagodite po želji)";

  const subject = oneLine(`Nova loša recenzija (${rating} od 5): ${orgName}`, 90);
  const greeting = firstName ? `Bok ${firstName},` : "Bok,";
  const intro = "Na Googleu je stigla nova loša ocjena. Što prije odgovorite, to bolje: javni odgovor vide svi koji čitaju recenzije.";
  const stars = `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
  const footer = `Ovo upozorenje šaljemo kontaktu tvrtke „${orgName}” u sklopu usluge NOVO Recenzije, jednom za svaku novu recenziju s ocjenom 3 ili manje. Isključivanje: ${input.settingsUrl} (Postavke, Upozorenje na lošu recenziju). Pitanja: ${input.contactEmail}.`;

  const font = "font-family:Helvetica,Arial,sans-serif";
  const mono = "font-family:'Courier New',Courier,monospace";
  const html = `<!doctype html>
<html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f7f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e5e5e5;${mono};font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#000000"><span style="display:inline-block;width:8px;height:8px;background:#ff7f00;margin-right:8px"></span>NOVO Recenzije</td></tr>
<tr><td style="padding:28px 28px 8px;${font};color:#000000">
<p style="margin:0 0 6px;${mono};font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#b00020">Upozorenje na lošu recenziju</p>
<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;color:#000000">${escapeHtml(orgName)}</h1>
<p style="margin:0 0 8px;font-size:18px;line-height:1.55">${escapeHtml(greeting)}</p>
<p style="margin:0 0 16px;font-size:18px;line-height:1.55">${escapeHtml(intro)}</p>
</td></tr>
<tr><td style="padding:0 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #000000;border-bottom:1px solid #e5e5e5"><tr><td style="padding:16px 0;${font}">
<p style="margin:0 0 4px;font-size:28px;line-height:1.2;font-weight:700;color:#b00020" aria-label="Ocjena ${rating} od 5">${escapeHtml(stars)} <span style="font-size:18px;color:#000000">${rating} od 5</span></p>
<p style="margin:0 0 12px;font-size:16px;line-height:1.4;color:#444444">${escapeHtml(reviewer)} · ${escapeHtml(when)}</p>
<p style="margin:0;font-size:18px;line-height:1.55;color:#000000">${comment ? `„${escapeHtml(comment)}”` : "Recenzija nema tekst, samo ocjenu."}</p>
</td></tr></table></td></tr>
<tr><td style="padding:20px 28px 8px;${font}">
<p style="margin:0 0 10px;font-size:16px;line-height:1.4;font-weight:700;color:#000000">${escapeHtml(replyLabel)}</p>
<p style="margin:0 0 20px;padding:14px 16px;background:#f7f7f7;border-left:4px solid #ff7f00;font-size:18px;line-height:1.55;color:#000000">${escapeHtml(reply)}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(input.replyUrl)}" style="display:inline-block;padding:16px 24px;background:#000000;color:#ffffff;font-size:18px;font-weight:700;text-decoration:none">Odgovori na Googleu</a></p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#444444">Odgovor kopirajte u Google i prilagodite. Ništa se ne objavljuje samo od sebe.</p>
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e5e5e5;${font};font-size:13px;line-height:1.5;color:#666666">${escapeHtml(footer)}</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    "NOVO Recenzije · Upozorenje na lošu recenziju",
    orgName,
    "",
    greeting,
    intro,
    "",
    `Ocjena: ${rating} od 5`,
    `${reviewer} · ${when}`,
    comment ? `„${comment}”` : "Recenzija nema tekst, samo ocjenu.",
    "",
    `${replyLabel}:`,
    reply,
    "",
    `Odgovori na Googleu: ${input.replyUrl}`,
    "Odgovor kopirajte u Google i prilagodite. Ništa se ne objavljuje samo od sebe.",
    "",
    footer,
  ].join("\n");

  return { subject, html, text };
}

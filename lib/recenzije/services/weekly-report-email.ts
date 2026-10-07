import { escapeHtml } from "@/lib/recenzije/utils";

/**
 * Čiste funkcije za tjedni izvještaj vlasniku: izbor primatelja i sastavljanje emaila.
 * Namjerno bez "server-only" i bez baze, da se mogu provjeriti jediničnim testom.
 * Sve dinamične vrijednosti u HTML-u prolaze kroz escapeHtml.
 */

export type WeeklyReportStats = {
  from: Date;
  to: Date;
  requestsSent: number;
  linksClicked: number;
  newReviews: number;
  /** Prosjek samo novih recenzija iz razdoblja; null kad ih nema. */
  averageRating: number | null;
  pendingFollowUps: number;
  /** Sve spremljene recenzije (kontekst, nije dio tjedna). */
  totalReviews: number;
  overallAverage: number | null;
};

/** "Aktivnost" znači da se u razdoblju nešto dogodilo; podsjetnici na čekanju su stanje, ne događaj. */
export function hasWeeklyActivity(s: Pick<WeeklyReportStats, "requestsSent" | "linksClicked" | "newReviews">) {
  return s.requestsSent > 0 || s.linksClicked > 0 || s.newReviews > 0;
}

type Role = "OWNER" | "ADMIN" | "MEMBER";
export type MemberCandidate = { role: Role; email: string; name: string | null; joinedAt: Date };

const ROLE_RANK: Record<Role, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

/** Vlasnik ako postoji, inače admin, inače najstariji član; unutar iste uloge onaj tko je prvi došao. */
export function pickRecipient<T extends MemberCandidate>(members: T[]): T | null {
  if (members.length === 0) return null;
  return [...members].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime())[0];
}

function safeTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("hr-HR", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/Zagreb";
  }
}

function formatDay(d: Date, tz: string) {
  return d.toLocaleDateString("hr-HR", { day: "numeric", month: "numeric", year: "numeric", timeZone: tz });
}

function formatInt(n: number) {
  return n.toLocaleString("hr-HR");
}

function formatRating(n: number | null) {
  return n == null ? "—" : n.toFixed(1).replace(".", ",");
}

/** Hrvatska množina: 1 zakazan podsjetnik, 2-4 zakazana podsjetnika, 5+ i 11-14 zakazanih podsjetnika. */
function scheduledFollowUps(n: number) {
  const last = n % 10;
  const lastTwo = n % 100;
  if (last === 1 && lastTwo !== 11) return "zakazan podsjetnik";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "zakazana podsjetnika";
  return "zakazanih podsjetnika";
}

/** Predmet je jedan redak; novi redovi i višak razmaka iz imena tvrtke ne smiju ući u njega. */
function oneLine(s: string, max = 90) {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildWeeklyReportEmail(input: {
  orgName: string;
  recipientName: string | null;
  timezone: string;
  stats: WeeklyReportStats;
  /** Puna adresa pregleda, npr. https://www.probajnovo.com/recenzije/pregled */
  dashboardUrl: string;
  /** Kontakt za one koji ne žele primati izvještaj. */
  contactEmail: string;
}): { subject: string; html: string; text: string } {
  const { stats } = input;
  const tz = safeTimeZone(input.timezone);
  const orgName = oneLine(input.orgName, 120) || "vaša tvrtka";
  const firstName = oneLine(input.recipientName ?? "", 60).split(" ")[0] ?? "";
  const range = `${formatDay(stats.from, tz)} – ${formatDay(stats.to, tz)}`;
  const active = hasWeeklyActivity(stats);

  const intro = active
    ? `Evo što se dogodilo u zadnjih 7 dana (${range}).`
    : `U zadnjih 7 dana (${range}) nije bilo aktivnosti: nije poslan nijedan zahtjev za recenziju, nitko nije kliknuo na link i nema novih recenzija.`;
  const hint = active
    ? ""
    : "Kad dodate klijenta i označite posao završenim, ovdje ćete vidjeti kako zahtjevi napreduju.";
  const pendingNote =
    stats.pendingFollowUps > 0
      ? `Trenutno čeka ${formatInt(stats.pendingFollowUps)} ${scheduledFollowUps(stats.pendingFollowUps)}.`
      : "";
  const overallNote =
    stats.totalReviews > 0
      ? `Ukupno spremljenih recenzija: ${formatInt(stats.totalReviews)}, prosječna ocjena ${formatRating(stats.overallAverage)}.`
      : "Još nema spremljenih recenzija.";

  const rows: [string, string][] = [
    ["Poslano zahtjeva", formatInt(stats.requestsSent)],
    ["Klikova na link", formatInt(stats.linksClicked)],
    ["Novih recenzija", formatInt(stats.newReviews)],
    ["Prosječna ocjena novih recenzija", formatRating(stats.averageRating)],
    ["Podsjetnika na čekanju", formatInt(stats.pendingFollowUps)],
  ];

  const subject = oneLine(`Tjedni izvještaj: ${orgName}`);
  const greeting = firstName ? `Bok ${firstName},` : "Bok,";
  const footer = `Ovaj izvještaj šaljemo jednom tjedno vlasniku računa „${orgName}” na NOVO Recenzije. Ako ga ne želite primati, javite nam se na ${input.contactEmail}.`;

  const font = "font-family:Helvetica,Arial,sans-serif";
  const mono = "font-family:'Courier New',Courier,monospace";
  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e5e5;${font};font-size:14px;color:#444444">${escapeHtml(label)}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #e5e5e5;${font};font-size:18px;font-weight:700;color:#000000">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f7f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e5e5e5;${mono};font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#000000"><span style="display:inline-block;width:8px;height:8px;background:#ff7f00;margin-right:8px"></span>NOVO Recenzije</td></tr>
<tr><td style="padding:28px 28px 8px;${font};color:#000000">
<p style="margin:0 0 6px;${mono};font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#666666">Tjedni izvještaj</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#000000">${escapeHtml(orgName)}</h1>
<p style="margin:0 0 6px;font-size:15px;line-height:1.55">${escapeHtml(greeting)}</p>
<p style="margin:0 0 ${hint || pendingNote ? "8" : "16"}px;font-size:15px;line-height:1.55">${escapeHtml(intro)}</p>
${hint ? `<p style="margin:0 0 ${pendingNote ? "8" : "16"}px;font-size:15px;line-height:1.55;color:#444444">${escapeHtml(hint)}</p>` : ""}${pendingNote ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#444444">${escapeHtml(pendingNote)}</p>` : ""}
</td></tr>
<tr><td style="padding:0 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #000000">${tableRows}</table></td></tr>
<tr><td style="padding:14px 28px 4px;${font};font-size:13px;line-height:1.5;color:#666666">${escapeHtml(overallNote)}</td></tr>
<tr><td style="padding:20px 28px 28px"><a href="${escapeHtml(input.dashboardUrl)}" style="display:inline-block;background:#000000;color:#ffffff;padding:13px 22px;${mono};font-size:12px;letter-spacing:1.4px;text-transform:uppercase;text-decoration:none">Otvori pregled</a></td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e5e5e5;${font};font-size:12px;line-height:1.5;color:#888888">${escapeHtml(footer)}</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    "NOVO Recenzije · Tjedni izvještaj",
    orgName,
    "",
    greeting,
    intro,
    ...(hint ? [hint] : []),
    ...(pendingNote ? [pendingNote] : []),
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    overallNote,
    "",
    `Otvori pregled: ${input.dashboardUrl}`,
    "",
    footer,
  ].join("\n");

  return { subject, html, text };
}

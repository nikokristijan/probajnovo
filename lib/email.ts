import { Resend } from "resend";

/**
 * Slanje email obavijesti vlasniku kad stigne novi upit (vidi lib/actions.ts
 * createInquiryAction). Namjerno "best effort" — ako RESEND_API_KEY nije
 * postavljen (npr. dok admin još nije napravio Resend račun) ili slanje iz
 * bilo kojeg razloga ne uspije, funkcija samo tiho ništa ne radi. Upit je već
 * spremljen u bazu i vidljiv u /admin/inquiries prije nego se ovo pozove, pa
 * neuspjeh emaila NIKAD ne smije srušiti ili poništiti sam upit.
 */

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || "NOVO <onboarding@resend.dev>";

export async function sendInquiryNotification(params: {
  to: string;
  sourceName: string;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // Resend još nije povezan — vidi lib/email.ts komentar gore.

  try {
    const resend = new Resend(apiKey);
    // Resend SDK ne baca uvijek iznimku na neuspjeh — kod npr. sandboxed
    // posiljatelja (onboarding@resend.dev) ili neverificirane domene vraca
    // { error } bez throw-a, pa to eksplicitno provjeravamo ispod.
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [params.to],
      replyTo: params.email,
      subject: `Novi upit — ${params.sourceName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="margin: 0 0 4px;">Novi upit za "${escapeHtml(params.sourceName)}"</h2>
          <p style="color: #666; margin: 0 0 20px; font-size: 14px;">Stigao je putem obrasca na probajnovo.com</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 4px 0; color: #666; width: 90px;">Ime</td><td style="padding: 4px 0;">${escapeHtml(params.name)}</td></tr>
            <tr><td style="padding: 4px 0; color: #666;">Email</td><td style="padding: 4px 0;"><a href="mailto:${escapeHtml(params.email)}">${escapeHtml(params.email)}</a></td></tr>
            ${params.phone ? `<tr><td style="padding: 4px 0; color: #666;">Telefon</td><td style="padding: 4px 0;">${escapeHtml(params.phone)}</td></tr>` : ""}
          </table>
          <p style="white-space: pre-wrap; background: #f5f1e8; border-radius: 8px; padding: 14px 16px; margin: 16px 0; font-size: 14.5px;">${escapeHtml(params.message)}</p>
          <p style="font-size: 13px; color: #999;">Odgovori izravno na ovaj mail (ide na ${escapeHtml(params.email)}), ili pogledaj sve upite u adminu.</p>
        </div>
      `,
    });
    if (error) {
      console.error("[sendInquiryNotification] Resend je vratio gresku:", error);
    }
  } catch (err) {
    // Tiho zanemari za korisnika — vidi komentar gore. Upit ostaje spremljen
    // bez obzira na ovo. Logiramo gresku radi dijagnostike u Vercel logovima.
    console.error("[sendInquiryNotification] Resend slanje nije uspjelo:", err);
  }
}

/**
 * Kratka potvrda gostu odmah nakon slanja upita ("primili smo, javljamo se
 * uskoro") — šalje se na email koji je gost sam upisao u obrazac, s prave
 * verificirane domene. Isto "best effort" ponašanje kao gore: ako
 * RESEND_API_KEY nije postavljen ili slanje ne uspije, tiho ne radi ništa —
 * upit je već spremljen i vlasnik je već (pokušano) obaviješten prije nego
 * se ovo pozove, pa gostova potvrda nikad ne smije srušiti odgovor.
 */
export async function sendGuestConfirmation(params: {
  to: string;
  sourceName: string;
  name: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [params.to],
      subject: `Primili smo tvoj upit — ${params.sourceName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="margin: 0 0 4px;">Hvala, ${escapeHtml(params.name)}!</h2>
          <p style="color: #444; font-size: 14.5px; line-height: 1.5; margin: 0 0 16px;">
            Primili smo tvoj upit za <strong>${escapeHtml(params.sourceName)}</strong> i javit ćemo
            ti se najkasnije u roku 24h.
          </p>
          <p style="font-size: 13px; color: #999; margin: 0;">
            Ovo je automatska potvrda — ne treba odgovarati na ovaj mail.
          </p>
        </div>
      `,
    });
    if (error) {
      console.error("[sendGuestConfirmation] Resend je vratio gresku:", error);
    }
  } catch (err) {
    console.error("[sendGuestConfirmation] Resend slanje nije uspjelo:", err);
  }
}

/**
 * Tjedni pregled novih upita — šalje se agenciji (agency.contactEmail), ne
 * pojedinim vlasnicima, jer je ovo nadzorni pregled preko svih vikendica/
 * firmi (vidi app/api/cron/weekly-digest i vercel.json, jednom tjedno).
 * Namjerno odvojeno od sendInquiryNotification: taj šalje odmah po upitu
 * pojedinom vlasniku, ovaj je tjedni zbroj za agenciju — različita
 * publika, pa i različiti "best effort" no-op ako nema upita ili nema
 * RESEND_API_KEY (ne šalje prazan email kad tjedan nema nijedan upit).
 */
export async function sendWeeklyDigest(params: {
  to: string;
  sinceLabel: string;
  totalCount: number;
  groups: { sourceName: string; count: number }[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  if (params.totalCount === 0) return; // Nema smisla slati prazan tjedni pregled.

  try {
    const resend = new Resend(apiKey);
    const rows = params.groups
      .sort((a, b) => b.count - a.count)
      .map(
        (g) =>
          `<tr><td style="padding: 6px 0; border-bottom: 1px solid #eee;">${escapeHtml(g.sourceName)}</td><td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${g.count}</td></tr>`
      )
      .join("");
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [params.to],
      subject: `Tjedni pregled upita — ${params.totalCount} ${params.totalCount === 1 ? "novi upit" : "novih upita"}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="margin: 0 0 4px;">Tjedni pregled upita</h2>
          <p style="color: #666; margin: 0 0 20px; font-size: 14px;">${escapeHtml(params.sinceLabel)} — ukupno ${params.totalCount}</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">${rows}</table>
          <p style="font-size: 13px; color: #999; margin-top: 20px;">Puni pregled u adminu: /admin/inquiries</p>
        </div>
      `,
    });
    if (error) {
      console.error("[sendWeeklyDigest] Resend je vratio gresku:", error);
    }
  } catch (err) {
    console.error("[sendWeeklyDigest] Resend slanje nije uspjelo:", err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

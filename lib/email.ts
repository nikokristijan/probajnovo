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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

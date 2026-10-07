import "server-only";
import { env, integrations } from "@/lib/recenzije/env";

/**
 * Transactional email through Resend's HTTP API (password resets, weekly reports).
 * Without RESEND_API_KEY the email is NOT sent; in development the content is
 * printed to the server console so the flow can still be tested locally.
 * Never throws: network errors and timeouts come back as { ok: false, error }.
 */
export async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!integrations.email()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`\n[email:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
      return { ok: true as const, dev: true };
    }
    return { ok: false as const, error: "Email nije postavljen (RESEND_API_KEY)." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html, text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false as const, error: `Slanje emaila nije uspjelo (${res.status})` };
    return { ok: true as const, dev: false };
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false as const, error: timedOut ? "Slanje emaila je isteklo. Pokušajte ponovno." : "Slanje emaila nije uspjelo (mreža)." };
  }
}

/**
 * Minimal E.164 normalisation. Accepts "+385 91 234 5678", "00385...", "091 234 5678"
 * (local numbers get the default country code). Returns null when it can't be a phone number.
 */
export function toE164(input: string, defaultCountryCode = "385"): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  if (!digits.startsWith("+")) {
    digits = digits.replace(/^0+/, "");
    digits = `+${defaultCountryCode}${digits}`;
  }
  const body = digits.slice(1);
  if (!/^\d{8,15}$/.test(body)) return null;
  return `+${body}`;
}

export function formatPhone(e164: string) {
  const us = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (us) return `+1 (${us[1]}) ${us[2]}-${us[3]}`;
  const hr = e164.match(/^\+385(\d{2})(\d{3})(\d+)$/);
  if (hr) return `+385 ${hr[1]} ${hr[2]} ${hr[3]}`;
  return e164;
}

/** Country calling code to assume for local numbers, from the organization's timezone. */
export function defaultCountryCode(timezone: string | null | undefined) {
  if (!timezone) return "385";
  if (timezone.startsWith("America/")) return "1";
  if (timezone === "Europe/London") return "44";
  if (timezone === "Europe/Berlin" || timezone === "Europe/Vienna") return timezone === "Europe/Berlin" ? "49" : "43";
  if (timezone === "Europe/Ljubljana") return "386";
  return "385";
}

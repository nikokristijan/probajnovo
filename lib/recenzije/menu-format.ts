/**
 * Čiste pomoćne funkcije za jelovnik i goste (bez baze i bez server-only, pa ih smiju koristiti i
 * komponente u pregledniku): cijene u centima, ispis cijene i maskiranje telefona.
 */

/** Najveća cijena stavke: 100 000 EUR (u centima). Sprječava slučajan unos poput 99999999. */
export const MAX_PRICE_CENTS = 10_000_000;

/** 550 -> "5,50 €"; 123456 -> "1.234,56 €". Novac je uvijek cijeli broj centi. */
export function formatPriceCents(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0;
  const euros = Math.floor(safe / 100);
  const rest = String(safe % 100).padStart(2, "0");
  return `${String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${rest} €`;
}

/** 550 -> "5,50": vrijednost za polje obrasca (bez znaka valute). */
export function priceCentsToInput(cents: number): string {
  return formatPriceCents(cents).replace(/\s*€$/, "").replace(/\./g, "");
}

const CURRENCY_WORDS = /(?:€|eur(?:a|o|e)?\b)/gi;

/**
 * "5,50", "5.5", "5", "€ 12", "12 EUR", "1.250,00", "1,250.00" -> cijene u centima; sve ostalo -> null.
 * Jedan razdjelnik iza kojeg slijede točno tri znamenke čita se kao tisućiti ("1.250" = 1250 EUR), jedan ili dvije
 * znamenke kao decimale; kad su prisutna oba razdjelnika, zadnji je decimalni.
 */
export function parsePriceToCents(input: string): number | null {
  const s = input.replace(CURRENCY_WORDS, " ").replace(/\s+/g, "");
  if (!/^\d[\d.,]*$/.test(s)) return null;

  let intPart: string;
  let decPart = "";
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (!hasDot && !hasComma) {
    intPart = s;
  } else if (hasDot && hasComma) {
    // "1.250,00" ili "1,250.00": zadnji razdjelnik je decimalni, onaj drugi tisućiti.
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const thousands = dec === "." ? "," : ".";
    const at = s.lastIndexOf(dec);
    const before = s.slice(0, at);
    decPart = s.slice(at + 1);
    if (before.includes(dec) || decPart.length < 1 || decPart.length > 2) return null;
    if (!new RegExp(`^\\d{1,3}(?:\\${thousands}\\d{3})*$`).test(before)) return null;
    intPart = before.split(thousands).join("");
  } else {
    const sep = hasDot ? "." : ",";
    const parts = s.split(sep);
    if (parts.length > 2) {
      // "1.250.000": sve su tisućite grupe.
      if (!parts.slice(1).every((g) => g.length === 3) || parts[0].length > 3) return null;
      intPart = parts.join("");
    } else if (parts[1].length === 3) {
      intPart = parts.join(""); // "1.250" = 1250
    } else if (parts[1].length >= 1 && parts[1].length <= 2) {
      intPart = parts[0];
      decPart = parts[1];
    } else {
      return null;
    }
  }
  if (!/^\d+$/.test(intPart) || intPart.length > 7) return null;
  const cents = Number(intPart) * 100 + Number((decPart + "00").slice(0, 2));
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= MAX_PRICE_CENTS ? cents : null;
}

/**
 * Maskirani telefon za tablicu gostiju: vidljiv je pozivni broj i zadnje tri znamenke ("+385 *** *** 567").
 * Cijeli broj vidi samo baza; operater ga ne treba za rad s popisom.
 */
export function maskPhone(e164: string): string {
  const p = e164.trim();
  if (p.length < 8) return "***";
  return `${p.slice(0, 4)} *** *** ${p.slice(-3)}`;
}

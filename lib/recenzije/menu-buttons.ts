/**
 * Neobavezne brze tipke na javnom jelovniku: "Ocijeni nas" (Google recenzija), "Wi-Fi" i "Kontakt". Čisto (bez baze, bez
 * server-only): provjeru i normalizaciju pri spremanju (services/menus.ts), gradnju javnog oblika i testove koristi isti kod.
 *
 * Pravila: samo tekst (nikad HTML; znakovi < i > se odbijaju gdje nisu potrebni), poveznice samo http(s), tel: i mailto:
 * (nikad javascript: ni data:), prazna vrijednost = "nema tipke". Svaka vrijednost se pri javnom čitanju PONOVNO provjerava,
 * pa neispravan zapis u bazi ne može stvoriti opasnu poveznicu.
 */
import { defaultCountryCode, toE164 } from "@/lib/recenzije/phone";

export const BUTTON_LIMITS = {
  wifiName: 64,
  wifiPassword: 128,
  phone: 32,
  email: 120,
  address: 160,
  instagram: 80,
} as const;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const good = <T>(value: T): Parsed<T> => ({ ok: true, value });
const bad = (error: string): Parsed<never> => ({ ok: false, error });

/** Hrvatski oblik uz broj: 1 znak, 2 do 4 znaka, 5 i više znakova (i 11 do 14 znakova). */
export function znakova(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} znak`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} znaka`;
  return `${n} znakova`;
}
export const maxChars = (n: number) => `najviše ${znakova(n)}`;

const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const ANGLE = /[<>]/;

/** Jedan redak: razmaci skupljeni, rubovi odrezani. */
export const oneLineText = (s: string) => s.replace(/\s+/g, " ").trim();

// --- Wi-Fi ---

export function parseWifiName(input: string | null | undefined): Parsed<string | null> {
  const v = oneLineText(input ?? "");
  if (!v) return good(null);
  if (v.length > BUTTON_LIMITS.wifiName) return bad(`Wi-Fi naziv: ${maxChars(BUTTON_LIMITS.wifiName)}`);
  if (CONTROL.test(v) || ANGLE.test(v)) return bad("Wi-Fi naziv: ne smije sadržavati znakove < i > ni nevidljive znakove.");
  return good(v);
}

/** Lozinka se ne preoblikuje (razmaci unutar nje su važni); smije sadržavati i < >, jer se prikazuje isključivo kao običan tekst. */
export function parseWifiPassword(input: string | null | undefined): Parsed<string | null> {
  const v = (input ?? "").trim();
  if (!v) return good(null);
  if (v.length > BUTTON_LIMITS.wifiPassword) return bad(`Wi-Fi lozinka: ${maxChars(BUTTON_LIMITS.wifiPassword)}`);
  if (CONTROL.test(v)) return bad("Wi-Fi lozinka: ne smije sadržavati nevidljive znakove.");
  return good(v);
}

// --- Kontakt ---

const PHONE_CHARS = /^\+?[\d\s().\/-]+$/;

/** Broj kako je upisan (razmaci skupljeni); mora se dati pretvoriti u E.164. `countryCode` je pozivni broj za lokalne brojeve. */
export function parseContactPhone(input: string | null | undefined, countryCode = "385"): Parsed<string | null> {
  const v = oneLineText(input ?? "");
  if (!v) return good(null);
  const err = "Telefon: upišite ispravan broj, npr. 091 234 5678 ili +385 91 234 5678.";
  if (v.length > BUTTON_LIMITS.phone) return bad(`Telefon: ${maxChars(BUTTON_LIMITS.phone)}`);
  if (!PHONE_CHARS.test(v) || toE164(v, countryCode) === null) return bad(err);
  return good(v);
}

/** Vrijednost za tel: poveznicu (E.164) ili null. */
export function telHrefOf(stored: string | null | undefined, countryCode = "385"): string | null {
  const v = oneLineText(stored ?? "");
  if (!v || v.length > BUTTON_LIMITS.phone || !PHONE_CHARS.test(v)) return null;
  const e = toE164(v, countryCode);
  return e ? `tel:${e}` : null;
}

const EMAIL = /^[^\s@<>()[\]\\,;:"%?#&]+@[^\s@<>()[\]\\,;:"%?#&]+\.[^\s@<>()[\]\\,;:"%?#&.]{2,}$/;

export function parseContactEmail(input: string | null | undefined): Parsed<string | null> {
  const v = (input ?? "").trim();
  if (!v) return good(null);
  if (v.length > BUTTON_LIMITS.email) return bad(`E-mail: ${maxChars(BUTTON_LIMITS.email)}`);
  if (!EMAIL.test(v) || v.includes("..") || v.split("@").length !== 2 || CONTROL.test(v)) {
    return bad("E-mail: upišite ispravnu adresu, npr. info@konoba.hr.");
  }
  return good(v);
}

export function mailtoHrefOf(stored: string | null | undefined): string | null {
  const p = parseContactEmail(stored);
  if (!p.ok || !p.value) return null;
  return `mailto:${p.value.split("@").map(encodeURIComponent).join("@")}`;
}

export function parseContactAddress(input: string | null | undefined): Parsed<string | null> {
  const v = oneLineText(input ?? "");
  if (!v) return good(null);
  if (v.length > BUTTON_LIMITS.address) return bad(`Adresa: ${maxChars(BUTTON_LIMITS.address)}`);
  if (CONTROL.test(v) || ANGLE.test(v)) return bad("Adresa: ne smije sadržavati znakove < i > ni nevidljive znakove.");
  return good(v);
}

/** Poveznica na Google Karte za adresu (traži se po tekstu adrese). */
export function mapsUrlOf(address: string | null | undefined): string | null {
  const p = parseContactAddress(address);
  if (!p.ok || !p.value) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.value)}`;
}

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const NOT_PROFILE = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "direct", "about", "legal", "developer"]);
const INSTAGRAM_ERROR = "Instagram: upišite korisničko ime (npr. @konoba) ili adresu profila (npr. instagram.com/konoba).";

/** "@konoba", "konoba", "instagram.com/konoba/", "https://www.instagram.com/konoba/?hl=hr" -> { handle: "konoba", url: "https://instagram.com/konoba" }. */
export function instagramOf(input: string | null | undefined): { handle: string; url: string } | null {
  const v = (input ?? "").trim();
  if (!v || v.length > 300 || CONTROL.test(v) || /\s/.test(v)) return null;
  let handle = v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || /^(www\.|m\.)?(instagram\.com|instagr\.am)(\/|$)/i.test(v)) {
    let u: URL;
    try {
      u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    } catch {
      return null;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (!/^(www\.|m\.)?(instagram\.com|instagr\.am)$/i.test(u.hostname)) return null;
    handle = u.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (handle.startsWith("@")) {
    handle = handle.slice(1);
  }
  if (!HANDLE.test(handle) || NOT_PROFILE.has(handle.toLowerCase())) return null;
  handle = handle.toLowerCase();
  return { handle, url: `https://instagram.com/${handle}` };
}

/** Sprema se normalizirana adresa profila (https://instagram.com/<ime>). */
export function parseContactInstagram(input: string | null | undefined): Parsed<string | null> {
  const raw = (input ?? "").trim();
  if (!raw) return good(null);
  if (raw.length > BUTTON_LIMITS.instagram) return bad(`Instagram: ${maxChars(BUTTON_LIMITS.instagram)}`);
  const p = instagramOf(raw);
  return p ? good(p.url) : bad(INSTAGRAM_ERROR);
}

/** Za polje u obrascu: spremljena adresa profila prikazana kao @ime. */
export function instagramDisplay(stored: string | null | undefined): string {
  const p = instagramOf(stored);
  return p ? `@${p.handle}` : (stored ?? "");
}

// --- Google recenzija ---

/** Samo http(s) adresa bez korisničkog imena i lozinke; vraća normaliziranu adresu ili null. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 2000 || CONTROL.test(v)) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password || !u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}

// --- Javni oblik ---

export type PublicContact = {
  phone: { display: string; href: string } | null;
  email: { address: string; href: string } | null;
  map: { address: string; href: string } | null;
  instagram: { handle: string; href: string } | null;
};
export type PublicMenuActions = {
  /** Google link za recenziju (samo kad je tipka uključena i tvrtka ima ispravan link). */
  reviewUrl: string | null;
  wifi: { name: string; password: string | null } | null;
  contact: PublicContact | null;
};

export type ButtonSource = {
  showReviewButton: boolean;
  orgReviewUrl: string | null | undefined;
  wifiName: string | null | undefined;
  wifiPassword: string | null | undefined;
  contactPhone: string | null | undefined;
  contactEmail: string | null | undefined;
  contactAddress: string | null | undefined;
  contactInstagram: string | null | undefined;
  /** Vremenska zona tvrtke: iz nje se uzima pozivni broj za lokalne brojeve. */
  timezone?: string | null;
};

/** Javni oblik tipki iz spremljenih vrijednosti. Svaka vrijednost se ponovno provjerava; neispravna se tiho izostavlja. */
export function buildPublicActions(src: ButtonSource): PublicMenuActions {
  const cc = defaultCountryCode(src.timezone);
  const reviewUrl = src.showReviewButton ? safeHttpUrl(src.orgReviewUrl) : null;

  const wn = parseWifiName(src.wifiName);
  const wp = parseWifiPassword(src.wifiPassword);
  const wifi = wn.ok && wn.value ? { name: wn.value, password: wp.ok ? wp.value : null } : null;

  const phoneP = parseContactPhone(src.contactPhone, cc);
  const phoneHref = phoneP.ok && phoneP.value ? telHrefOf(phoneP.value, cc) : null;
  const phone = phoneP.ok && phoneP.value && phoneHref ? { display: phoneP.value, href: phoneHref } : null;

  const emailP = parseContactEmail(src.contactEmail);
  const emailHref = emailP.ok && emailP.value ? mailtoHrefOf(emailP.value) : null;
  const email = emailP.ok && emailP.value && emailHref ? { address: emailP.value, href: emailHref } : null;

  const addrP = parseContactAddress(src.contactAddress);
  const mapHref = addrP.ok && addrP.value ? mapsUrlOf(addrP.value) : null;
  const map = addrP.ok && addrP.value && mapHref ? { address: addrP.value, href: mapHref } : null;

  const ig = instagramOf(src.contactInstagram);
  const instagram = ig ? { handle: ig.handle, href: ig.url } : null;

  const contact = phone || email || map || instagram ? { phone, email, map, instagram } : null;
  return { reviewUrl, wifi, contact };
}

export const NO_ACTIONS: PublicMenuActions = { reviewUrl: null, wifi: null, contact: null };

export function hasQuickActions(a: PublicMenuActions | null | undefined): boolean {
  return Boolean(a && (a.reviewUrl || a.wifi || a.contact));
}

/** Kontakt je samo telefon: tipka postaje izravna poveznica "Nazovi" bez ploče. */
export function contactIsPhoneOnly(c: PublicContact | null): boolean {
  return Boolean(c && c.phone && !c.email && !c.map && !c.instagram);
}

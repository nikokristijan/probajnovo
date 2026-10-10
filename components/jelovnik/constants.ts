/**
 * Zajedničke oznake javnih stranica jelovnika (/jelovnik/<slug>): nazivi kolačića i ključ u localStorage.
 * Bez server-only: koriste ih i komponente u pregledniku i poslužiteljski kod.
 */

/** Odabrani jezik jelovnika ("hr" ili "en"). Nije osobni podatak; čita ga i poslužitelj da prvi prikaz bude već na pravom jeziku. */
export const LANG_COOKIE = "jl_lang";
/** Isti izbor u localStorageu (pomoćni spremnik kad su kolačići isključeni). */
export const LANG_STORAGE_KEY = "jl:lang";
/** Godinu dana. */
export const LANG_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/** Kratka potvrda nakon unosa broja živi samo toliko sekundi (traka se ionako sama sakrije za nekoliko sekundi). */
export const FLASH_MAX_AGE_SECONDS = 30;

/** Najveća dopuštena duljina polja obrasca na vratima (poslužitelj svejedno ponovno provjerava sve). */
export const GATE_LIMITS = { phone: 40, slug: 80, table: 40, honeypot: 600 } as const;

/** Prikaz maskiranog broja u potvrdi: "+385 *** *** 567" (isti oblik daje maskPhone u lib/recenzije/menu-format.ts). */
export const MASKED_PHONE_PATTERN = /^\+\d{1,4} \*\*\* \*\*\* \d{3}$/;

/** Mirne poruke na vratima, na jednom mjestu da obrazac i akcija poslužitelja govore isto. */
export const GATE_MESSAGES = {
  phone: "Broj nije ispravan. Upišite broj mobitela, npr. 091 234 5678, ili s pozivnim brojem, npr. +49 151 2345678.",
  consent: "Za nastavak označite potvrdu iznad gumba.",
  busy: "Previše pokušaja u kratko vrijeme. Pričekajte minutu pa pokušajte ponovno.",
  generic: "Nešto je pošlo po zlu. Pokušajte ponovno za nekoliko trenutaka.",
} as const;

/*
 * NOVO Recenzije: raspored QR plakata. Čiste funkcije bez ovisnosti o Reactu ili
 * serveru, pa ih koriste i pregled, i ispis, i preuzimanje SVG-a.
 *
 * Sve mjere su u "mm" za A4 (platno 210 x 297). A6 kartica koristi isti raspored
 * na pola veličine (viewBox ostaje isti), samo su sitni mono natpisi malo veći
 * da ostanu čitljivi.
 */

import { slugify } from "@/lib/recenzije/utils";

export type PosterVariant = "a4" | "a6";

export const POSTER_VARIANTS: {
  id: PosterVariant;
  label: string;
  size: string;
  widthMm: number;
  heightMm: number;
  /** CSS @page veličina (imenovani papir da preglednik ponudi pravi format). */
  page: "A4" | "A6";
}[] = [
  { id: "a4", label: "A4 plakat", size: "210 × 297 mm", widthMm: 210, heightMm: 297, page: "A4" },
  { id: "a6", label: "A6 stolna kartica", size: "105 × 148 mm", widthMm: 105, heightMm: 148, page: "A6" },
];

export function variantInfo(v: PosterVariant) {
  return POSTER_VARIANTS.find((x) => x.id === v) ?? POSTER_VARIANTS[0];
}

export const CANVAS = { w: 210, h: 297 } as const;

export const COLORS = {
  ink: "#000000",
  paper: "#ffffff",
  orange: "#ff7f00",
  blue: "#0000c3",
  star: "#f2a100",
  muted: "#6b6b6b",
} as const;

export const FONT_SANS = "Space Grotesk, Helvetica Neue, Helvetica, Arial, sans-serif";
export const FONT_MONO = "JetBrains Mono, Courier New, Courier, monospace";

export const HEADLINE = ["Ostavite nam", "recenziju", "na Googleu"] as const;
export const STEPS = [
  { n: "01", text: "Skenirajte" },
  { n: "02", text: "Ocijenite" },
  { n: "03", text: "Hvala" },
] as const;

/* ---------- Plakat jelovnika (QR vodi na /jelovnik/<slug>) ---------- */

/** "review" = QR za Google recenziju (izvorni plakat), "menu" = QR za digitalni jelovnik lokala. */
export type PosterKind = "review" | "menu";

export const MENU_KICKER = "DIGITALNI JELOVNIK";
export const MENU_HEADLINE = ["Skenirajte", "i otvorite", "jelovnik"] as const;

/**
 * Koraci na plakatu jelovnika. Drugi korak ovisi o postavci lokala: ako gost smije pogledati jelovnik bez broja,
 * plakat ne smije tvrditi da je broj obavezan.
 */
export function menuSteps(allowSkip: boolean) {
  return [
    { n: "01", text: "Skenirajte", note: "kamerom mobitela" },
    allowSkip ? { n: "02", text: "Otvorite", note: "bez aplikacije" } : { n: "02", text: "Upišite broj", note: "u par sekundi" },
    { n: "03", text: "Birajte", note: "i prijatno" },
  ] as const;
}

/** Oblik zvjezdice iz primitives.Stars (kutija 20 x 20). */
export const STAR_PATH = "M10 1.5l2.6 5.5 6 .7-4.5 4.1 1.2 5.9L10 14.8l-5.3 2.9 1.2-5.9L1.4 7.7l6-.7z";

/* ---------- Naziv tvrtke: lom u retke i smanjivanje fonta ---------- */

const NAME_MAX_WIDTH = 164;
const NAME_MAX_FONT = 13;
const NAME_MIN_FONT = 7.5;
const NAME_MAX_LINES = 2;
const NAME_MAX_CHARS = 120;

/** Gruba procjena širine znaka (podebljani grotesk), u višekratnicima veličine fonta. Namjerno malo široko. */
function charWidth(ch: string): number {
  if (ch === " ") return 0.3;
  if (".,:;!|'’`".includes(ch) || ch === "i" || ch === "l") return 0.32;
  if ("jtfrI()[]-–/".includes(ch)) return 0.4;
  if ("mwMW@%".includes(ch)) return 0.92;
  if (/\p{Lu}/u.test(ch)) return 0.74;
  if (/\d/.test(ch)) return 0.62;
  return 0.6;
}

export function textWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += charWidth(ch);
  return w * fontSize;
}

function wrapWords(words: string[], fontSize: number, maxWidth: number, hard: boolean): string[] | null {
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    let rest = word;
    if (textWidth(rest, fontSize) > maxWidth) {
      if (!hard) return null;
      // Predugačka riječ: lomi po znakovima.
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      while (textWidth(rest, fontSize) > maxWidth) {
        let n = rest.length;
        while (n > 1 && textWidth(rest.slice(0, n), fontSize) > maxWidth) n--;
        lines.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
    }
    const next = cur ? `${cur} ${rest}` : rest;
    if (textWidth(next, fontSize) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = rest;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function ellipsize(line: string, fontSize: number, maxWidth: number): string {
  let s = line;
  while (s.length > 1 && textWidth(`${s}…`, fontSize) > maxWidth) s = s.slice(0, -1).trimEnd();
  return `${s}…`;
}

export type FittedName = { lines: string[]; fontSize: number };

/** Naziv tvrtke u najviše 2 retka; font se smanjuje dok ne stane, a tek na kraju se skraćuje s "…". */
export function fitName(raw: string): FittedName {
  const cleaned = raw.replace(/\s+/g, " ").trim() || "Vaša tvrtka";
  const name = cleaned.length > NAME_MAX_CHARS ? `${cleaned.slice(0, NAME_MAX_CHARS - 1).trimEnd()}…` : cleaned;
  const words = name.split(" ");
  for (let fs = NAME_MAX_FONT; fs >= NAME_MIN_FONT; fs -= 0.5) {
    const lines = wrapWords(words, fs, NAME_MAX_WIDTH, false);
    if (lines && lines.length <= NAME_MAX_LINES) return { lines, fontSize: fs };
  }
  const lines = wrapWords(words, NAME_MIN_FONT, NAME_MAX_WIDTH, true) ?? [name];
  if (lines.length <= NAME_MAX_LINES) return { lines, fontSize: NAME_MIN_FONT };
  const kept = lines.slice(0, NAME_MAX_LINES);
  kept[NAME_MAX_LINES - 1] = ellipsize(kept[NAME_MAX_LINES - 1], NAME_MIN_FONT, NAME_MAX_WIDTH);
  return { lines: kept, fontSize: NAME_MIN_FONT };
}

/* ---------- Preuzimanje ---------- */

export function posterFileName(orgName: string, variant: PosterVariant, part: "plakat" | "qr" = "plakat"): string {
  const slug = slugify(orgName) || "tvrtka";
  return part === "qr" ? `qr-${slug}.svg` : `plakat-${slug}-${variant}.svg`;
}

/** Datoteke plakata jelovnika: jelovnik-<lokal>[-stol-<n>]-a4.svg, samo QR: jelovnik-qr-<lokal>[-stol-<n>].svg. */
export function menuPosterFileName(orgName: string, variant: PosterVariant, part: "plakat" | "qr" = "plakat", table?: string | null): string {
  const slug = slugify(orgName) || "lokal";
  const t = table ? `-stol-${slugify(table) || "x"}` : "";
  return part === "qr" ? `jelovnik-qr-${slug}${t}.svg` : `jelovnik-${slug}${t}-${variant}.svg`;
}

export function tableSheetFileName(orgName: string, page: number): string {
  return `jelovnik-stolovi-${slugify(orgName) || "lokal"}-str-${page}.svg`;
}

/** Samo QR (s mirnom zonom od 4 modula), kao samostalan SVG za dizajnere ili tiskare. */
export function qrOnlySvg(qr: { size: number; path: string }, title = "QR kod za Google recenziju"): string {
  const total = qr.size + 8;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="60mm" height="60mm" shape-rendering="crispEdges">`,
    `<title>${title}</title>`,
    `<rect width="${total}" height="${total}" fill="${COLORS.paper}"/>`,
    `<path transform="translate(4 4)" fill="${COLORS.ink}" d="${qr.path}"/>`,
    "</svg>",
  ].join("");
}

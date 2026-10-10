/*
 * NOVO Recenzije: gradi SVG plakata kao običan tekst. Isti tekst se koristi za
 * pregled na stranici, za ispis i za preuzimanje, pa se oni nikad ne razilaze.
 * Nema ovisnosti o Reactu ni o serveru. Naziv tvrtke se uvijek escapea.
 *
 * Mjere su u jedinicama platna širine 210 (A4 u mm). A6 koristi isto platno,
 * samo je fizički upola manji, pa su mali mono natpisi povećani (faktor k).
 */

import { escapeHtml } from "@/lib/recenzije/utils";
import {
  CANVAS,
  COLORS,
  FONT_MONO,
  FONT_SANS,
  HEADLINE,
  MENU_HEADLINE,
  MENU_KICKER,
  STAR_PATH,
  STEPS,
  fitName,
  menuSteps,
  variantInfo,
  type PosterKind,
  type PosterVariant,
} from "./poster-layout";

export type PosterSvgOptions = {
  orgName: string;
  /** QR iz `buildQrMatrix` (server): `size` modula po stranici i jedan SVG path. */
  qr: { size: number; path: string };
  variant: PosterVariant;
  /**
   * true: za ugradnju u stranicu (bez fiksne veličine, fontovi iz stranice).
   * false: samostalna datoteka s dimenzijama u mm i XML zaglavljem.
   */
  inline?: boolean;
  /** "review" (zadano) = plakat za Google recenziju; "menu" = plakat za digitalni jelovnik. */
  kind?: PosterKind;
  /** Samo za kind "menu": broj stola (ispisuje se umjesto zvjezdica) i smije li gost pogledati jelovnik bez broja. */
  menu?: { table?: string | null; allowSkip?: boolean };
};

/** Fontovi stranice (next/font varijable), uz rezervu ako varijabla ne postoji. */
const INLINE_SANS = `var(--font-space-grotesk), ${FONT_SANS}`;
const INLINE_MONO = `var(--font-jetbrains-mono), ${FONT_MONO}`;

const MARGIN = 18;
const FRAME = 8;
const DIVIDER_Y = 64;
const NAME_BOTTOM = 56;
const HEAD_SIZE = 23;
const HEAD_FIRST = 88;
const STAR_SIZE = 16;
const STAR_GAP = 4;
const STAR_Y = 144;
const QR_BOX = 106;
const QR_Y = 170;
const COL_X = 136;

const STEP_NOTES = ["kamerom mobitela", "u par sekundi", "to nam puno znači"] as const;

const n = (v: number) => Number(v.toFixed(2));

/** Izbacuje znakove koji nisu dopušteni u XML 1.0 (kontrolni znakovi, usamljeni surogati). */
function cleanText(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const ok = c === 9 || c === 10 || c === 13 || (c >= 0x20 && c !== 0xfffe && c !== 0xffff && !(c >= 0xd800 && c <= 0xdfff));
    out += ok ? ch : " ";
  }
  return out;
}

export function buildPosterSvg({ orgName, qr, variant, inline = false, kind = "review", menu }: PosterSvgOptions): string {
  const isMenu = kind === "menu";
  const headline = isMenu ? MENU_HEADLINE : HEADLINE;
  const steps = isMenu ? menuSteps(menu?.allowSkip === true) : STEPS.map((s, i) => ({ ...s, note: STEP_NOTES[i] }));
  const kickerText = isMenu ? MENU_KICKER : "GOOGLE RECENZIJA";
  const table = isMenu ? Array.from(cleanText(menu?.table ?? "").replace(/\s+/g, " ").trim()).slice(0, 12).join("") : "";
  const v = variantInfo(variant);
  const W = CANVAS.w;
  const H = Math.round((W * v.heightMm) / v.widthMm);
  const k = variant === "a6" ? 1.35 : 1;
  const right = W - MARGIN;

  // Lom po znakovima i "…" mogu prepoloviti surogatni par (emoji u nazivu), pa se retci čiste i nakon uklapanja.
  const fitted = fitName(cleanText(orgName));
  const name = { ...fitted, lines: fitted.lines.map(cleanText) };
  const sans = inline ? INLINE_SANS : FONT_SANS;
  const mono = inline ? INLINE_MONO : FONT_MONO;
  const monoAttr = inline ? `style="font-family:${mono}"` : `font-family="${mono}"`;

  const parts: string[] = [];

  // Papir i tanki okvir.
  parts.push(`<rect width="${W}" height="${H}" fill="${COLORS.paper}"/>`);
  parts.push(
    `<rect x="${FRAME}" y="${FRAME}" width="${W - FRAME * 2}" height="${H - FRAME * 2}" fill="none" stroke="${COLORS.ink}" stroke-width="0.6"/>`
  );

  // Natpis u NOVO stilu: narančasti kvadratić + mono oznaka velikim slovima.
  const kick = 3.6 * k;
  parts.push(`<rect x="${MARGIN}" y="19.5" width="4" height="4" fill="${COLORS.orange}"/>`);
  parts.push(
    `<text x="${MARGIN + 7}" y="23" font-size="${n(kick)}" letter-spacing="${n(kick * 0.12)}" fill="${COLORS.ink}" ${monoAttr}>${kickerText}</text>`
  );

  // Naziv tvrtke: dno bloka uvijek sjedi tik iznad crte.
  const lh = name.fontSize * 1.12;
  const firstBase = NAME_BOTTOM - (name.lines.length - 1) * lh;
  name.lines.forEach((line, i) => {
    parts.push(
      `<text x="${MARGIN}" y="${n(firstBase + i * lh)}" font-size="${name.fontSize}" font-weight="700" letter-spacing="${n(-name.fontSize * 0.01)}" fill="${COLORS.ink}">${escapeHtml(line)}</text>`
    );
  });
  parts.push(`<path d="M${MARGIN} ${DIVIDER_Y}H${right}" fill="none" stroke="${COLORS.ink}" stroke-width="0.5"/>`);

  // Naslov u tri retka; zadnja riječ plavo.
  headline.forEach((line, i) => {
    const y = n(HEAD_FIRST + i * HEAD_SIZE);
    let body = escapeHtml(line);
    if (i === headline.length - 1) {
      const cut = line.lastIndexOf(" ") + 1;
      body = `${escapeHtml(line.slice(0, cut))}<tspan fill="${COLORS.blue}">${escapeHtml(line.slice(cut))}</tspan>`;
    }
    parts.push(
      `<text x="${MARGIN}" y="${y}" font-size="${HEAD_SIZE}" font-weight="700" letter-spacing="${n(-HEAD_SIZE * 0.02)}" fill="${COLORS.ink}">${body}</text>`
    );
  });

  if (!isMenu) {
    // Pet zvjezdica (oblik kao u aplikaciji, kutija 20 x 20).
    const scale = STAR_SIZE / 20;
    for (let i = 0; i < 5; i++) {
      const x = MARGIN + i * (STAR_SIZE + STAR_GAP);
      parts.push(`<path transform="translate(${x} ${STAR_Y}) scale(${scale})" d="${STAR_PATH}" fill="${COLORS.star}"/>`);
    }
  } else if (table) {
    // Plakat za jedan stol: veliki natpis "STOL 12" na mjestu zvjezdica.
    parts.push(`<rect x="${MARGIN}" y="${STAR_Y + 3}" width="4" height="4" fill="${COLORS.orange}"/>`);
    parts.push(
      `<text x="${MARGIN + 8}" y="${STAR_Y + 14}" font-size="16" font-weight="700" letter-spacing="-0.3" fill="${COLORS.ink}">Stol ${escapeHtml(table)}</text>`
    );
  } else {
    parts.push(`<rect x="${MARGIN}" y="${STAR_Y + 6}" width="34" height="2.4" fill="${COLORS.orange}"/>`);
  }

  // QR u bijelom okviru; mirna zona (4 modula) je dio kutije.
  const cell = QR_BOX / (qr.size + 8);
  parts.push(
    `<rect x="${MARGIN}" y="${QR_Y}" width="${QR_BOX}" height="${QR_BOX}" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="0.8"/>`
  );
  parts.push(
    `<g transform="translate(${n(MARGIN + cell * 4)} ${n(QR_Y + cell * 4)}) scale(${Number(cell.toFixed(4))})"><path d="${qr.path}" fill="${COLORS.ink}" shape-rendering="crispEdges"/></g>`
  );

  // Tri koraka pokraj koda.
  const row = QR_BOX / 3;
  for (let i = 0; i < 3; i++) {
    const y = QR_Y + i * row;
    parts.push(`<path d="M${COL_X} ${n(y)}H${right}" fill="none" stroke="${COLORS.ink}" stroke-width="0.4"/>`);
    parts.push(
      `<text x="${COL_X}" y="${n(y + 9.5)}" font-size="${n(3.8 * k)}" letter-spacing="${n(3.8 * k * 0.12)}" fill="${COLORS.blue}" ${monoAttr}>${steps[i].n}</text>`
    );
    parts.push(
      `<text x="${COL_X}" y="${n(y + 21.5)}" font-size="8.6" font-weight="700" letter-spacing="-0.1" fill="${COLORS.ink}">${escapeHtml(steps[i].text)}</text>`
    );
    parts.push(
      `<text x="${COL_X}" y="${n(y + 29)}" font-size="${n(3.1 * k)}" fill="${COLORS.muted}" ${monoAttr}>${escapeHtml(steps[i].note)}</text>`
    );
  }
  parts.push(`<path d="M${COL_X} ${QR_Y + QR_BOX}H${right}" fill="none" stroke="${COLORS.ink}" stroke-width="0.4"/>`);

  const label = isMenu
    ? `QR plakat jelovnika za ${name.lines.join(" ")}${table ? `, stol ${table}` : ""}: ${headline.join(" ")}. ${steps.map((s) => s.text).join(", ")}.`
    : `QR plakat za ${name.lines.join(" ")}: ${HEADLINE.join(" ")}. ${STEPS.map((s) => s.text).join(", ")}.`;
  const rootAttrs = inline
    ? `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(label)}" style="display:block;width:100%;height:auto;font-family:${sans}"`
    : `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${v.widthMm}mm" height="${v.heightMm}mm" font-family="${sans}"`;

  return [
    inline ? "" : '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg ${rootAttrs}>`,
    `<title>${escapeHtml(label)}</title>`,
    ...parts,
    "</svg>",
  ].join("");
}

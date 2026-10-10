/*
 * NOVO Recenzije: ploča sa svim stolovima. A4 stranica s mrežom malih kartica (3 x 4 = 12 po stranici), svaka s
 * QR kodom jelovnika za jedan stol i natpisom "Stol N". Isprekidani rub je crta za rezanje. Čista funkcija bez Reacta
 * i bez servera; sve što dolazi od korisnika (naziv lokala, oznaka stola) prolazi kroz cleanText + escapeHtml.
 */

import { escapeHtml } from "@/lib/recenzije/utils";
import { COLORS, FONT_MONO, FONT_SANS, ellipsize, textWidth } from "./poster-layout";

export const SHEET_COLS = 3;
export const SHEET_ROWS = 4;
export const SHEET_PER_PAGE = SHEET_COLS * SHEET_ROWS;

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 10;
const QR_BOX = 38;

const INLINE_SANS = `var(--font-space-grotesk), ${FONT_SANS}`;
const INLINE_MONO = `var(--font-jetbrains-mono), ${FONT_MONO}`;

export type TableQr = { label: string; qr: { size: number; path: string } };

const n = (v: number) => Number(v.toFixed(2));

function cleanText(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const ok = c === 9 || c === 10 || c === 13 || (c >= 0x20 && c !== 0xfffe && c !== 0xffff && !(c >= 0xd800 && c <= 0xdfff));
    out += ok ? ch : " ";
  }
  return out;
}

/** Naziv lokala u jednom retku: smanjuje se do najmanjeg fonta, pa se skraćuje s "…". */
function fitLine(raw: string, maxWidth: number, maxFont: number, minFont: number): { text: string; fontSize: number } {
  const text = cleanText(raw).replace(/\s+/g, " ").trim() || "Lokal";
  for (let fs = maxFont; fs >= minFont; fs -= 0.2) {
    if (textWidth(text, fs) <= maxWidth) return { text, fontSize: n(fs) };
  }
  return { text: Array.from(ellipsize(text, minFont, maxWidth)).join(""), fontSize: minFont };
}

export function sheetPageCount(tables: number): number {
  return Math.max(1, Math.ceil(tables / SHEET_PER_PAGE));
}

/** Jedna SVG stranica za svaki blok od 12 stolova. `inline`: za ugradnju u stranicu (kao poster-svg). */
export function buildTableSheetPages({ orgName, tables, inline = false }: { orgName: string; tables: TableQr[]; inline?: boolean }): string[] {
  const cellW = (PAGE_W - MARGIN * 2) / SHEET_COLS;
  const cellH = (PAGE_H - MARGIN * 2) / SHEET_ROWS;
  const sans = inline ? INLINE_SANS : FONT_SANS;
  const mono = inline ? INLINE_MONO : FONT_MONO;
  const monoAttr = inline ? `style="font-family:${mono}"` : `font-family="${mono}"`;
  const venue = fitLine(orgName, cellW - 10, 4, 2.6);

  const pages: string[] = [];
  for (let start = 0; start < Math.max(tables.length, 1); start += SHEET_PER_PAGE) {
    const chunk = tables.slice(start, start + SHEET_PER_PAGE);
    const parts: string[] = [`<rect width="${PAGE_W}" height="${PAGE_H}" fill="${COLORS.paper}"/>`];
    chunk.forEach((t, i) => {
      const col = i % SHEET_COLS;
      const row = Math.floor(i / SHEET_COLS);
      const x = MARGIN + col * cellW;
      const y = MARGIN + row * cellH;
      const cx = x + cellW / 2;
      const label = Array.from(cleanText(t.label).replace(/\s+/g, " ").trim()).slice(0, 12).join("");

      // Crta za rezanje.
      parts.push(
        `<rect x="${n(x)}" y="${n(y)}" width="${n(cellW)}" height="${n(cellH)}" fill="none" stroke="#9a9a9a" stroke-width="0.25" stroke-dasharray="1.6 1.2"/>`
      );
      // Naziv lokala (mono natpis + naziv).
      parts.push(`<rect x="${n(x + 5)}" y="${n(y + 5.2)}" width="2" height="2" fill="${COLORS.orange}"/>`);
      parts.push(
        `<text x="${n(x + 9)}" y="${n(y + 7)}" font-size="2.4" letter-spacing="0.3" fill="${COLORS.ink}" ${monoAttr}>JELOVNIK</text>`
      );
      parts.push(
        `<text x="${n(cx)}" y="${n(y + 12)}" text-anchor="middle" font-size="${venue.fontSize}" font-weight="700" fill="${COLORS.ink}">${escapeHtml(venue.text)}</text>`
      );
      // QR u okviru; mirna zona (4 modula) je dio kutije.
      const bx = cx - QR_BOX / 2;
      const by = y + 14.5;
      const cell = QR_BOX / (t.qr.size + 8);
      parts.push(`<rect x="${n(bx)}" y="${n(by)}" width="${QR_BOX}" height="${QR_BOX}" fill="${COLORS.paper}" stroke="${COLORS.ink}" stroke-width="0.4"/>`);
      parts.push(
        `<g transform="translate(${n(bx + cell * 4)} ${n(by + cell * 4)}) scale(${Number(cell.toFixed(4))})"><path d="${t.qr.path}" fill="${COLORS.ink}" shape-rendering="crispEdges"/></g>`
      );
      // Natpis stola.
      parts.push(
        `<text x="${n(cx)}" y="${n(by + QR_BOX + 8.8)}" text-anchor="middle" font-size="8.5" font-weight="700" letter-spacing="-0.1" fill="${COLORS.ink}">Stol ${escapeHtml(label)}</text>`
      );
      parts.push(
        `<text x="${n(cx)}" y="${n(by + QR_BOX + 13.6)}" text-anchor="middle" font-size="2.7" fill="${COLORS.muted}" ${monoAttr}>skenirajte za jelovnik</text>`
      );
    });

    const first = chunk[0]?.label ?? "";
    const last = chunk[chunk.length - 1]?.label ?? "";
    const range = chunk.length > 1 ? `stolovi ${first} do ${last}` : chunk.length === 1 ? `stol ${first}` : "bez stolova";
    const aria = `QR kodovi jelovnika za ${venue.text}: ${range}`;
    const root = inline
      ? `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" role="img" aria-label="${escapeHtml(aria)}" style="display:block;width:100%;height:auto;font-family:${sans}"`
      : `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}mm" height="${PAGE_H}mm" font-family="${sans}"`;
    pages.push([inline ? "" : '<?xml version="1.0" encoding="UTF-8"?>', `<svg ${root}>`, `<title>${escapeHtml(aria)}</title>`, ...parts, "</svg>"].join(""));
  }
  return pages;
}

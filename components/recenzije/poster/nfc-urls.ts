/*
 * NOVO Recenzije: popis adresa za upis na NFC pločice jelovnika. Čiste funkcije (bez Reacta, baze i servera), pa ih
 * koriste i stranica i provjere. Adrese gradi ISTA funkcija kao QR kod (menuUrlWithTable, vidi lib/recenzije/menu-url.ts),
 * a osnovna adresa dolazi s poslužitelja (env.appUrl + /jelovnik/<slug>); domena se nigdje ne upisuje ručno.
 */

import { MAX_TABLES } from "@/components/recenzije/app/menu/menu-types";
import { HOSPITALITY_SETUP, extraPieces, extraPiecesCostEur } from "@/lib/hospitality-plans";
import { menuUrlWithTable } from "@/lib/recenzije/menu-url";
import { slugify } from "@/lib/recenzije/utils";

export type NfcRow = { table: string; url: string };

export type NfcRange = { ok: true; count: number; from: number } | { ok: false; error: string };

/**
 * Isti raspon kao ploča sa stolovima: "Broj stolova" (1 do MAX_TABLES) i "Prvi stol" (0 do 9999, prazno = 1).
 * Poruke su iste kao u poslužiteljskoj provjeri (buildMenuTableQrsAction).
 */
export function parseNfcRange(countRaw: string, fromRaw: string, max: number = MAX_TABLES): NfcRange {
  const c = countRaw.trim();
  if (c === "" || !Number.isFinite(Number(c))) return { ok: false, error: "Broj stolova: upišite broj." };
  const count = Number(c);
  if (!Number.isInteger(count)) return { ok: false, error: "Broj stolova: upišite cijeli broj." };
  if (count < 1) return { ok: false, error: "Broj stolova: najmanje 1." };
  if (count > max) return { ok: false, error: `Broj stolova: najviše ${max}.` };
  const f = fromRaw.trim();
  const from = f === "" ? 1 : Number(f);
  if (!Number.isFinite(from)) return { ok: false, error: "Prvi stol: upišite broj." };
  if (!Number.isInteger(from)) return { ok: false, error: "Prvi stol: upišite cijeli broj." };
  if (from < 0) return { ok: false, error: "Prvi stol: najmanje 0." };
  if (from > 9999) return { ok: false, error: "Prvi stol: najviše 9999." };
  return { ok: true, count, from };
}

/** Adrese za stolove from .. from+count-1: ?stol=<n>, točno kao u QR kodu na kartici tog stola. */
export function buildNfcRows(baseUrl: string, count: number, from: number): NfcRow[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const table = String(from + i);
    return { table, url: menuUrlWithTable(baseUrl, table) };
  });
}

/** Jedna adresa po retku (za "Kopiraj sve" i .txt). */
export function nfcTextList(rows: NfcRow[]): string {
  return rows.map((r) => r.url).join("\n");
}

/** Jedna ćelija CSV-a (RFC 4180): navodnici samo kad treba (zarez, navodnik, novi redak), a navodnik se udvostručuje. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV s zaglavljem "stol,url" i retcima završenima s CRLF (Excel i LibreOffice). */
export function nfcCsv(rows: NfcRow[]): string {
  return ["stol,url", ...rows.map((r) => `${csvCell(r.table)},${csvCell(r.url)}`)].join("\r\n") + "\r\n";
}

export function nfcFileName(orgName: string, ext: "csv" | "txt"): string {
  return `jelovnik-nfc-${slugify(orgName) || "lokal"}.${ext}`;
}

/* ---------- Komadi (stalak s QR kodom + NFC pločica) ---------- */

/** Najviše komada po stolu (stol s puno mjesta može trebati komad po gostu). */
export const MAX_PIECES_PER_TABLE = 12;
/** Najviše kartica u jednom ispisu "Svi stolovi" (preglednik gradi sve stranice odjednom). */
export const MAX_SHEET_CARDS = 600;

export type PiecesParse = { ok: true; value: number } | { ok: false; error: string };

/** "Komada po stolu": prazno = 1, cijeli broj 1 do MAX_PIECES_PER_TABLE. */
export function parsePiecesPerTable(raw: string): PiecesParse {
  const t = raw.trim();
  if (t === "") return { ok: true, value: 1 };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, error: "Komada po stolu: upišite broj." };
  if (!Number.isInteger(n)) return { ok: false, error: "Komada po stolu: upišite cijeli broj." };
  if (n < 1) return { ok: false, error: "Komada po stolu: najmanje 1." };
  if (n > MAX_PIECES_PER_TABLE) return { ok: false, error: `Komada po stolu: najviše ${MAX_PIECES_PER_TABLE}.` };
  return { ok: true, value: n };
}

export type PieceTotals = {
  tables: number;
  perTable: number;
  /** stolovi x komada po stolu */
  total: number;
  /** Koliko komada je uključeno u postavljanje. */
  included: number;
  /** Komadi preko uključenih (0 ako stane). */
  extra: number;
  /** Doplata za dodatne komade uz mjesečno plaćanje, EUR bez PDV-a. */
  extraEur: number;
  /** Doplata za dodatne komade uz godišnju uplatu, EUR bez PDV-a. */
  extraAnnualEur: number;
};

/** Veličina kompleta: stolovi x komada po stolu, naspram komada uključenih u postavljanje. */
export function pieceTotals(tables: number, perTable: number): PieceTotals {
  const t = Math.max(0, Math.floor(tables));
  const p = Math.max(0, Math.floor(perTable));
  const total = t * p;
  return {
    tables: t,
    perTable: p,
    total,
    included: HOSPITALITY_SETUP.includedPieces,
    extra: extraPieces(total),
    extraEur: extraPiecesCostEur(total, false),
    extraAnnualEur: extraPiecesCostEur(total, true),
  };
}

/** Svaka kartica se ponavlja `perTable` puta za redom (isti ?stol): 1,1,2,2,3,3... */
export function repeatCards<T>(items: T[], perTable: number): T[] {
  const k = Math.max(1, Math.floor(perTable));
  return items.flatMap((it) => Array.from({ length: k }, () => it));
}

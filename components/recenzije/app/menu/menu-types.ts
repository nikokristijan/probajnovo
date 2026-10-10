/*
 * Oblici podataka između stranice /recenzije/jelovnik (poslužitelj) i njezinih komponenti (preglednik).
 * Čisti tipovi i funkcije bez baze i bez server-only: smiju ih uvoziti i poslužitelj i preglednik.
 * Ovdje su samo obični objekti (bez Date): sve što ide u preglednik je JSON.
 */

import type { GuestOutcome } from "@/lib/recenzije/db/schema";
import type { Tone } from "@/components/recenzije/ui/primitives";
import type { GuestRow } from "@/lib/recenzije/services/guests";

export type ItemDTO = {
  id: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  priceCents: number;
  allergens: string | null;
  available: boolean;
};

export type CategoryDTO = {
  id: string;
  name: string;
  nameEn: string | null;
  items: ItemDTO[];
};

export type MenuSettingsDTO = {
  slug: string;
  enabled: boolean;
  title: string;
  intro: string | null;
  introEn: string | null;
  externalUrl: string | null;
  allowSkip: boolean;
  delayMinutes: number;
};

export type GuestSummaryDTO = {
  total: number;
  last24h: number;
  last7d: number;
  scheduled: number;
  sent: number;
  waiting: number;
};

export type GuestView = {
  id: string;
  /** "danas 14:35" / "jučer 21:10" / "12.10. 09:00": već u vremenskoj zoni tvrtke. */
  whenLabel: string;
  /** Maskirani broj ("+385 *** *** 567"). */
  phone: string;
  table: string | null;
  tone: Tone;
  status: string;
  /** Dodatno objašnjenje (npr. razlog neuspjeha) za title/sitni tekst. */
  detail: string | null;
};

export type MenuTab = "stavke" | "uvoz" | "postavke" | "gosti";
export const MENU_TABS: { id: MenuTab; label: string }[] = [
  { id: "stavke", label: "Stavke" },
  { id: "uvoz", label: "Uvoz" },
  { id: "postavke", label: "Postavke" },
  { id: "gosti", label: "Gosti" },
];
export function parseMenuTab(raw: string | null | undefined): MenuTab {
  return MENU_TABS.some((t) => t.id === raw) ? (raw as MenuTab) : "stavke";
}

/** Najviše stolova u jednom ispisu "Svi stolovi" (QR kodovi se grade na poslužitelju). */
export const MAX_TABLES = 100;

/** Odgode koje operater može odabrati (60 do 240 minuta). */
export const DELAY_OPTIONS: { value: number; label: string }[] = [
  { value: 60, label: "60 minuta (sat vremena)" },
  { value: 90, label: "90 minuta (sat i pol)" },
  { value: 105, label: "105 minuta (blizu dva sata)" },
  { value: 120, label: "120 minuta (dva sata)" },
  { value: 150, label: "150 minuta (dva i pol sata)" },
  { value: 180, label: "180 minuta (tri sata)" },
  { value: 240, label: "240 minuta (četiri sata)" },
];

/** Hrvatski množinski oblici: 1 stavka, 2 do 4 stavke, 5 i više stavki (i 11 do 14 stavki). */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// --- Vrijeme u zoni tvrtke ---

function safeZone(tz: string): string {
  try {
    new Intl.DateTimeFormat("hr-HR", { timeZone: tz });
    return tz;
  } catch {
    return "Europe/Zagreb";
  }
}

function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function hhmm(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("hr-HR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}

/** "danas 14:35", "sutra 09:00", "jučer 21:10", inače "12.10. 09:00". Radi se na poslužitelju, pa nema razlike pri prikazu u pregledniku. */
export function whenLabel(date: Date, tz: string, now: Date): string {
  const zone = safeZone(tz);
  const key = dayKey(date, zone);
  const today = dayKey(now, zone);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000), zone);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000), zone);
  const time = hhmm(date, zone);
  if (key === today) return `danas ${time}`;
  if (key === tomorrow) return `sutra ${time}`;
  if (key === yesterday) return `jučer ${time}`;
  const dm = new Intl.DateTimeFormat("hr-HR", { timeZone: zone, day: "numeric", month: "numeric" }).format(date);
  return `${dm.replace(/\s/g, "")} ${time}`;
}

const SKIPPED: Record<GuestOutcome, { tone: Tone; status: string; detail: string }> = {
  scheduled: { tone: "blue", status: "Zakazano", detail: "" },
  deduped: { tone: "neutral", status: "Preskočeno: već kontaktiran", detail: "Isti je broj od ovog lokala već dobio zahtjev u zadnjih 30 dana." },
  opted_out: { tone: "amber", status: "Preskočeno: odjavljen", detail: "Broj se odjavio od SMS-ova, pa mu se ništa ne šalje." },
  inactive: { tone: "amber", status: "Pretplata nije aktivna", detail: "Slanje je pauzirano dok pretplata nije aktivna." },
  sms_limit: { tone: "amber", status: "Limit SMS-ova", detail: "Potrošen je mjesečni limit SMS-ova paketa." },
  no_review_url: { tone: "amber", status: "Nema linka za recenzije", detail: "Dodajte Google link za recenzije u Postavkama, inače se poruka ne može poslati." },
  automation_off: { tone: "amber", status: "Automatizacija isključena", detail: "Automatizacija za goste jelovnika je isključena." },
  already_reviewed: { tone: "neutral", status: "Preskočeno: već ocijenio", detail: "Taj je gost već ostavio recenziju." },
  demo: { tone: "neutral", status: "Demo: ne šalje se", detail: "Demo radni prostor ništa ne šalje." },
};

/** Jedan redak tablice gostiju: status poruke u jednoj kratkoj oznaci. */
export function toGuestView(row: GuestRow, tz: string, now: Date): GuestView {
  const base = { id: row.id, whenLabel: whenLabel(row.createdAt, tz, now), phone: row.phoneMasked, table: row.table };
  if (row.state === "skipped") {
    const s = SKIPPED[row.outcome] ?? SKIPPED.demo;
    return { ...base, tone: s.tone, status: s.status, detail: s.detail || row.outcomeLabel };
  }
  if (row.state === "sent") return { ...base, tone: "green", status: "Poslano", detail: null };
  if (row.state === "failed") return { ...base, tone: "red", status: "Slanje nije uspjelo", detail: row.error };
  if (row.state === "cancelled") return { ...base, tone: "neutral", status: "Otkazano", detail: "Poruka je otkazana prije slanja." };
  // waiting
  if (row.sendAt && row.sendAt.getTime() > now.getTime()) {
    return { ...base, tone: "blue", status: `Zakazano za ${whenLabel(row.sendAt, tz, now)}`, detail: null };
  }
  return { ...base, tone: "blue", status: "Čeka slanje", detail: "Vrijeme je prošlo, poruka odlazi pri idućoj obradi." };
}

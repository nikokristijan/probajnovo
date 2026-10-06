import type { QuantityDiscount } from "@/lib/db/schema";

/** Popusti sortirani od najmanje količine; nevažeći redci izbačeni. */
export function normalizeDiscounts(tiers: QuantityDiscount[] | null | undefined): QuantityDiscount[] {
  return (tiers ?? [])
    .filter((t) => Number.isFinite(t.minQty) && Number.isFinite(t.percent) && t.minQty >= 2 && t.percent > 0)
    .map((t) => ({ minQty: Math.round(t.minQty), percent: Math.min(90, Math.round(t.percent)) }))
    .sort((a, b) => a.minQty - b.minQty);
}

/** Postotak popusta koji vrijedi za danu količinu (najveći prag koji je dosegnut). */
export function discountFor(qty: number, tiers: QuantityDiscount[]): number {
  let pct = 0;
  for (const t of tiers) if (qty >= t.minQty) pct = t.percent;
  return pct;
}

/** Ukupan iznos za količinu, s popustom. Zaokruženo na cent. */
export function lineTotal(unitPrice: number, qty: number, percent: number): number {
  return Math.round(unitPrice * qty * (100 - percent)) / 100;
}

export function eur(n: number): string {
  const cents = Math.round(n * 100) % 100 !== 0;
  return `${n.toLocaleString("hr-HR", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })} €`;
}

/** Akcija na proizvodu: je li aktivna danas i koja je cijena po komadu nakon nje. */
export function saleInfo(
  p: { priceEur: number | null; salePercent?: number | null; saleEndsAt?: string | null },
  today: string
): { active: boolean; percent: number; price: number | null; endsAt: string | null } {
  const percent = p.salePercent ?? 0;
  const active = p.priceEur != null && percent > 0 && (!p.saleEndsAt || p.saleEndsAt >= today);
  return {
    active,
    percent: active ? percent : 0,
    price: active ? lineTotal(p.priceEur!, 1, percent) : p.priceEur,
    endsAt: active ? (p.saleEndsAt ?? null) : null,
  };
}

/** "2026-10-31" → "31. 10." */
export function shortDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${Number(day)}. ${Number(m)}.`;
}

"use client";

import { useState } from "react";
import type { QuantityDiscount } from "@/lib/db/schema";
import { discountFor, eur, lineTotal } from "@/lib/pricing";
import { track } from "@/lib/track";

export const QTY_EVENT = "novo:qty";
const DEFAULT_OPTIONS = [1, 3, 5, 10];

/** Gumbi količine: 1 + pragovi popusta (ako ih ima), inače 1/3/5/10. */
function optionsFor(tiers: QuantityDiscount[]): number[] {
  if (!tiers.length) return DEFAULT_OPTIONS;
  const opts = [1, ...tiers.map((t) => t.minQty)];
  for (const n of DEFAULT_OPTIONS) if (opts.length < 4 && !opts.includes(n)) opts.push(n);
  return [...new Set(opts)].sort((a, b) => a - b).slice(0, 4);
}

/**
 * Brzi odabir količine pokraj cijene: odmah pokaže iznos (s količinskim
 * popustom, ako ga ima), a klik na "Zatraži ponudu" prenese količinu u
 * obrazac za upit i skrola do njega.
 */
export default function QtyQuickPick({
  priceEur,
  ctaLabel,
  productName,
  discounts = [],
}: {
  priceEur: number | null;
  ctaLabel: string;
  productName: string;
  discounts?: QuantityDiscount[];
}) {
  const [qty, setQty] = useState(1);
  const options = optionsFor(discounts);
  const pct = discountFor(qty, discounts);
  const next = discounts.find((t) => t.minQty > qty);

  const go = () => {
    track("InitiateCheckout", {
      content_name: productName,
      num_items: qty,
      ...(priceEur != null ? { value: lineTotal(priceEur, qty, pct), currency: "EUR" } : {}),
    });
    window.dispatchEvent(new CustomEvent(QTY_EVENT, { detail: qty }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("upit")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const saved = priceEur != null && pct > 0 ? Math.round((qty * priceEur - lineTotal(priceEur, qty, pct)) * 100) / 100 : 0;

  return (
    <div className="pq-pick">
      <span className="pq-label mono" id="pq-pick-label">
        KOLIČINA
      </span>
      <div className="pq-pick-row" role="radiogroup" aria-labelledby="pq-pick-label">
        {options.map((n) => {
          const p = discountFor(n, discounts);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={qty === n}
              className={qty === n ? "pq-pick-opt is-on" : "pq-pick-opt"}
              onClick={() => setQty(n)}
            >
              {p > 0 && <span className="pq-pick-badge mono">−{p} %</span>}
              <span className="pq-pick-n">{n} kom</span>
              {priceEur != null && (
                <span className="pq-pick-sum mono">
                  {p > 0 && <s className="pq-pick-was">{eur(n * priceEur)}</s>}
                  {eur(lineTotal(priceEur, n, p))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {priceEur != null && discounts.length > 0 && (saved > 0 || next) && (
        <p className={saved > 0 ? "pq-pick-save is-on mono" : "pq-pick-save mono"} aria-live="polite">
          {saved > 0
            ? `UŠTEDA ${eur(saved)} · ` +
              (next ? `OD ${next.minQty} KOM −${next.percent} %` : `${eur(lineTotal(priceEur, 1, pct))} / KOM`)
            : `UZMITE ${next!.minQty}+ KOM I PLATITE −${next!.percent} % PO KOMADU`}
        </p>
      )}
      <button type="button" className="novo-os-cta mono pq-pick-cta" onClick={go}>
        {ctaLabel} →
      </button>
      <p className="pq-pick-note mono">BESPLATNO I BEZ OBVEZE · ODGOVOR UNUTAR 24 H</p>
    </div>
  );
}

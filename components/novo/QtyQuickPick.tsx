"use client";

import { useState } from "react";
import type { QuantityDiscount } from "@/lib/db/schema";
import { discountFor, eur, lineTotal } from "@/lib/pricing";
import { track } from "@/lib/track";
import { ContactLink, WhatsAppIcon } from "@/components/novo/ProductContactLinks";

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
 * Kupovni blok kao u webshopovima: količina kao mali gumbi, jedan glavni gumb
 * s ukupnim iznosom, WhatsApp kao sporedni gumb i jedan red sitnih jamstava.
 * Klik na glavni gumb prenese količinu u obrazac za upit i skrola do njega.
 */
export default function QtyQuickPick({
  priceEur,
  ctaLabel,
  productName,
  discounts = [],
  whatsappHref = null,
}: {
  priceEur: number | null;
  ctaLabel: string;
  productName: string;
  discounts?: QuantityDiscount[];
  whatsappHref?: string | null;
}) {
  const [qty, setQty] = useState(1);
  const options = optionsFor(discounts);
  const pct = discountFor(qty, discounts);
  const total = priceEur != null ? lineTotal(priceEur, qty, pct) : null;

  const go = () => {
    track("InitiateCheckout", {
      content_name: productName,
      num_items: qty,
      ...(total != null ? { value: total, currency: "EUR" } : {}),
    });
    window.dispatchEvent(new CustomEvent(QTY_EVENT, { detail: qty }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("upit")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

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
              {n}
              {p > 0 && <span className="pq-pick-badge">−{p} %</span>}
            </button>
          );
        })}
      </div>

      <div className="pq-pick-actions">
        <button type="button" className="novo-os-cta mono pq-pick-cta" onClick={go}>
          {ctaLabel}
          {total != null && (
            <span className="pq-pick-total">
              {" · "}
              {pct > 0 && priceEur != null && <s>{eur(qty * priceEur)}</s>} {eur(total)}
            </span>
          )}
        </button>
        {whatsappHref && (
          <ContactLink
            href={whatsappHref}
            productName={productName}
            channel="whatsapp"
            className="pq-pick-wa"
            ariaLabel="Pitajte na WhatsAppu"
          >
            <WhatsAppIcon size={22} />
          </ContactLink>
        )}
      </div>

      <ul className="pq-trust">
        <li>Ponuda bez obveze</li>
        <li>Odgovor unutar 24 h</li>
        <li>Plaćanje tek nakon dogovora</li>
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";

export const QTY_EVENT = "novo:qty";
const OPTIONS = [1, 3, 5, 10];

/**
 * Brzi odabir količine pokraj cijene: odmah pokaže okvirni iznos, a klik na
 * "Zatraži ponudu" prenese količinu u obrazac za upit i skrola do njega.
 */
export default function QtyQuickPick({ priceEur, ctaLabel }: { priceEur: number | null; ctaLabel: string }) {
  const [qty, setQty] = useState(1);

  const go = () => {
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
        {OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={qty === n}
            className={qty === n ? "pq-pick-opt is-on" : "pq-pick-opt"}
            onClick={() => setQty(n)}
          >
            <span className="pq-pick-n">{n} kom</span>
            {priceEur != null && <span className="pq-pick-sum mono">{(n * priceEur).toLocaleString("hr-HR")} €</span>}
          </button>
        ))}
      </div>
      <button type="button" className="novo-os-cta mono pq-pick-cta" onClick={go}>
        {ctaLabel} →
      </button>
      <p className="pq-pick-note mono">BESPLATNO I BEZ OBVEZE · ODGOVOR UNUTAR 24 H</p>
    </div>
  );
}

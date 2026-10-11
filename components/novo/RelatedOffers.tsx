import { useId } from "react";
import Link from "next/link";
import SystemTile from "@/components/novo/SystemTile";
import type { RelatedOffer } from "@/lib/related-products";

/**
 * Kartice povezanih ponuda ("Uz ovo ide i", "Možda vam treba i"). Naslov odjeljka piše stranica koja ga koristi,
 * ovdje je samo popis. Cijela kartica je jedna poveznica; "Saznaj više" je oznaka unutar nje, ne zasebna meta.
 * Stilovi su u app/globals.css (.ro-*).
 */
export default function RelatedOffers({
  offers,
  label,
}: {
  offers: RelatedOffer[];
  label?: string;
}) {
  const uid = useId();
  if (offers.length === 0) return null;
  return (
    <div className="ro">
      <ul className="ro-list" aria-label={label}>
        {offers.map((o) => (
          <li key={o.key} className="ro-item">
            <Link
              href={o.href}
              className="ro-card"
              aria-labelledby={`${uid}-${o.key}-n`}
              aria-describedby={`${uid}-${o.key}-b`}
            >
              <div className="ro-tile">
                {o.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.image}
                    alt=""
                    className="ro-img"
                    loading="lazy"
                    decoding="async"
                  />
                ) : o.tile ? (
                  <SystemTile kind={o.tile} />
                ) : null}
              </div>
              <div className="ro-body">
                <span className="ro-kicker mono">{o.kicker}</span>
                <h3 id={`${uid}-${o.key}-n`} className="ro-name">
                  {o.name}
                </h3>
                <span id={`${uid}-${o.key}-b`} className="ro-benefit">
                  {o.benefit}
                </span>
                <div className="ro-foot">
                  {o.priceText && (
                    <span className="ro-price mono">{o.priceText}</span>
                  )}
                  <span className="ro-go">
                    Saznaj više <span aria-hidden="true">→</span>
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

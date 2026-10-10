import { formatPriceCents } from "@/lib/recenzije/menu-format";
import type { PublicCategory, PublicMenuInfo } from "@/lib/recenzije/services/menus";

/** Koliko kategorija i stavki po kategoriji se ispisuje iza vrata: dovoljno za uvjerljivu pozadinu, malo HTML-a. */
export const BACKDROP_CATEGORIES = 2;
export const BACKDROP_ITEMS = 4;

/**
 * Pozadina iza malog prozora na vratima: zamućen, zatamnjen prikaz stranice. Čisto ukrasna (aria-hidden, inert, bez
 * fokusa i klikova). Lokal koji dopušta pregled bez broja (allow_skip) ima javni jelovnik i bez unosa, pa se iza vrata
 * prikazuje njegov STVARNI početak (zaglavlje i prve dvije kategorije, nekoliko stavki). Inače se crta neutralan kostur
 * (sive trake bez ijednog stvarnog naziva ili cijene), da izvorni kod vrata ne otkriva sadržaj jelovnika.
 */
export function GateBackdrop({ menu, categories }: { menu: PublicMenuInfo; categories: PublicCategory[] | null }) {
  const real = categories && categories.length > 0 ? categories.slice(0, BACKDROP_CATEGORIES) : null;
  return (
    <div className="jl-backdrop" aria-hidden="true" inert data-kind={real ? "real" : "placeholder"}>
      <div className="jl-backdrop-in">{real ? <RealPreview menu={menu} categories={real} all={categories ?? []} /> : <Placeholder />}</div>
    </div>
  );
}

function RealPreview({ menu, categories, all }: { menu: PublicMenuInfo; categories: PublicCategory[]; all: PublicCategory[] }) {
  return (
    <>
      <div className="jl-wrap jl-head">
        <div className="jl-brand jl-brand-name">{menu.venueName}</div>
        <div className="jl-kicker">{menu.title}</div>
      </div>
      <div className="jl-nav jl-nav-static">
        <div className="jl-nav-in">
          <div className="jl-chips">
            {all.slice(0, 6).map((c) => (
              <span key={c.id} className="jl-chip">
                {c.name}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="jl-wrap jl-secs">
        {categories.map((c) => (
          <div key={c.id} className="jl-sec">
            <div className="jl-sec-h">{c.name}</div>
            <ul className="jl-items">
              {c.items.slice(0, BACKDROP_ITEMS).map((it) => (
                <li key={it.id} className="jl-item">
                  <div className="jl-item-top">
                    <div className="jl-item-name">{it.name}</div>
                    {it.priceCents > 0 && (
                      <>
                        <span className="jl-leader" />
                        <span className="jl-price">{formatPriceCents(it.priceCents)}</span>
                      </>
                    )}
                  </div>
                  {it.description && <p className="jl-desc">{it.description}</p>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}

/** Kostur bez ikakvog stvarnog teksta: samo oblici (naziv, traka kategorija, dvije skupine stavki). */
function Placeholder() {
  const bars = (widths: number[]) =>
    widths.map((w, i) => (
      <div key={i} className="jl-ph-row">
        <div className="jl-ph-top">
          <span className="jl-ph-bar" style={{ width: `${w}%` }} />
          <span className="jl-ph-bar jl-ph-price" />
        </div>
        <span className="jl-ph-bar jl-ph-desc" style={{ width: `${Math.max(40, w + 18)}%` }} />
      </div>
    ));
  return (
    <>
      <div className="jl-wrap jl-head">
        <span className="jl-ph-bar jl-ph-brand" />
        <span className="jl-ph-bar jl-ph-kicker" />
      </div>
      <div className="jl-nav jl-nav-static">
        <div className="jl-nav-in">
          <div className="jl-chips">
            {[84, 104, 76, 92, 68].map((w, i) => (
              <span key={i} className="jl-ph-bar jl-ph-chip" style={{ width: w }} />
            ))}
          </div>
        </div>
      </div>
      <div className="jl-wrap jl-secs">
        {[0, 1].map((s) => (
          <div key={s} className="jl-sec">
            <span className="jl-ph-bar jl-ph-sec" />
            {bars(s === 0 ? [46, 58, 40, 52] : [54, 42, 60, 48])}
          </div>
        ))}
      </div>
    </>
  );
}

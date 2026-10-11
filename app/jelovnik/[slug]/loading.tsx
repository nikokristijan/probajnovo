"use client";

import { useMenuKind } from "@/components/jelovnik/kind-context";
import { menuNoun } from "@/lib/recenzije/menu-noun";

/**
 * Kostur dok se jelovnik učitava: iste mjere kao stvarni sadržaj (znak, oznaka, uvod, traka kategorija, naslov i nekoliko stavki),
 * da se pri dolasku sadržaja ništa ne pomakne. Vrsta stranice (jelovnik ili meni) dolazi iz layouta [slug] (kind-context.tsx).
 * Širine i razmaci su u klasama (jelovnik.css), ne u stilovima na elementima.
 */
export default function Loading() {
  const kind = useMenuKind();
  return (
    <div className="jl-menu" data-lang="hr" aria-busy="true">
      <main className="jl-main">
        <div className="jl-wrap jl-head jl-skel-head" role="status" aria-label={kind ? `Učitavanje ${menuNoun(kind).gen}` : "Učitavanje"}>
          <span className="jl-skel jl-skel-shimmer jl-skel-brand" />
          <span className="jl-skel jl-skel-shimmer jl-skel-kicker" />
          <span className="jl-skel jl-skel-shimmer jl-skel-line" />
          <span className="jl-skel jl-skel-shimmer jl-skel-line is-short" />
        </div>
        <div className="jl-nav" aria-hidden>
          <div className="jl-nav-in">
            <div className="jl-chips">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="jl-skel jl-skel-shimmer jl-skel-chip" />
              ))}
            </div>
          </div>
        </div>
        <div className="jl-wrap jl-secs" aria-hidden>
          <div className="jl-sec">
            <span className="jl-skel jl-skel-shimmer jl-skel-sec" />
            <div className="jl-items">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="jl-item">
                  <span className="jl-skel jl-skel-shimmer jl-skel-name" />
                  <span className="jl-skel jl-skel-shimmer jl-skel-desc" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

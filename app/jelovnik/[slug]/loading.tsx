"use client";

import { useMenuKind } from "@/components/jelovnik/kind-context";
import { menuNoun } from "@/lib/recenzije/menu-noun";

/**
 * Kostur dok se jelovnik učitava: iste mjere kao stvarni sadržaj (znak, uvod, traka kategorija, nekoliko stavki), bez skakanja.
 * Vrsta stranice (jelovnik ili meni) dolazi iz layouta [slug] (kind-context.tsx).
 */
export default function Loading() {
  const kind = useMenuKind();
  return (
    <div className="jl-menu" data-lang="hr" aria-busy="true">
      <main className="jl-main">
        <div className="jl-wrap jl-head" role="status" aria-label={kind ? `Učitavanje ${menuNoun(kind).gen}` : "Učitavanje"}>
          <span className="jl-skel jl-skel-shimmer jl-skel-brand" />
          <span className="jl-skel jl-skel-shimmer" style={{ width: 96, height: 12, margin: "20px auto 0" }} />
          <span className="jl-skel jl-skel-shimmer" style={{ width: "86%", height: 14, margin: "22px auto 0" }} />
          <span className="jl-skel jl-skel-shimmer" style={{ width: "58%", height: 14, margin: "10px auto 0" }} />
        </div>
        <div className="jl-nav" aria-hidden>
          <div className="jl-nav-in">
            <div className="jl-chips">
              {[88, 104, 72, 96].map((w, i) => (
                <span key={i} className="jl-skel jl-skel-shimmer" style={{ width: w, height: 20, flex: "none", margin: "12px 14px" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="jl-wrap" aria-hidden>
          <span className="jl-skel jl-skel-shimmer" style={{ width: "46%", height: 30, margin: "48px auto 0" }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="jl-skel-row">
              <span className="jl-skel jl-skel-shimmer" style={{ width: `${62 - i * 6}%`, height: 18 }} />
              <span className="jl-skel jl-skel-shimmer" style={{ width: "86%", height: 13, marginTop: 10 }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

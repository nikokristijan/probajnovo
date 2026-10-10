/** Kostur dok se jelovnik učitava: ista visina kao stvarni sadržaj (naslov, traka kategorija, nekoliko stavki), bez skakanja. */
export default function Loading() {
  return (
    <div className="jl-menu" data-lang="hr" aria-busy="true">
      <main className="jl-main">
        <div className="jl-wrap jl-head" role="status" aria-label="Učitavanje jelovnika">
          <div className="jl-head-top">
            <span className="jl-skel jl-skel-shimmer" style={{ width: 96, height: 12 }} />
          </div>
          <span className="jl-skel jl-skel-shimmer" style={{ width: "72%", height: 40, marginTop: 8 }} />
          <span className="jl-skel jl-skel-shimmer" style={{ width: "92%", height: 16, marginTop: 18 }} />
          <span className="jl-skel jl-skel-shimmer" style={{ width: "64%", height: 16, marginTop: 8 }} />
        </div>
        <div className="jl-nav" aria-hidden>
          <div className="jl-nav-in">
            <div className="jl-chips">
              {[88, 104, 72, 96].map((w, i) => (
                <span key={i} className="jl-skel jl-skel-shimmer" style={{ width: w, height: 44, flex: "none" }} />
              ))}
            </div>
          </div>
        </div>
        <div className="jl-wrap" aria-hidden>
          <span className="jl-skel jl-skel-shimmer" style={{ width: "40%", height: 28, marginTop: 28 }} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ padding: "16px 0", borderBottom: "1px solid #e6e6e6" }}>
              <span className="jl-skel jl-skel-shimmer" style={{ width: `${60 - i * 6}%`, height: 18 }} />
              <span className="jl-skel jl-skel-shimmer" style={{ width: "86%", height: 14, marginTop: 10 }} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

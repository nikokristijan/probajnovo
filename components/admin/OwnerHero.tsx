"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * "Naslovna" kartica vlasničkog dashboarda (app/admin/page.tsx OwnerDashboard)
 * — inspirirano Netflixovom velikom "hero" karticom (jedna dramatična brojka
 * na vrhu), Duolingovim streakom i ciljem dana (loss aversion + napredak),
 * i Instagram/TikTok "story ring" prstenom oko ključne brojke. Namjerno
 * ostaje u svijetlom NOVO brendu (navy #0000c3 → orange #ff7f00 gradient),
 * ne posebna tamna tema — vidi globals.css .owner-hero.
 *
 * Animacije (count-up, konfeti, crtanje prstena) su čisti CSS/JS bez
 * biblioteka, isti duh kao admin-chart-* — zato "use client" (treba
 * useEffect za requestAnimationFrame count-up).
 */
export default function OwnerHero({
  monthLabel,
  netEur,
  deltaPct,
  isRecord,
  streak,
  streakIsNew,
  goalDays,
  currentDays,
  yoyDeltaDays,
}: {
  monthLabel: string;
  netEur: number;
  /** % promjena neto zarade vs prethodni mjesec, null ako nema podataka za usporedbu. */
  deltaPct: number | null;
  /** Je li ovo najbolji mjesec ikad (po neto zaradi) — pokreće konfeti + banner. */
  isRecord: boolean;
  streak: number;
  /** Je li streak upravo danas povećan (za suptilni pop na broju). */
  streakIsNew: boolean;
  goalDays: number;
  currentDays: number;
  /** Razlika dana zauzeća vs isti mjesec prošle godine, null ako nema podataka. */
  yoyDeltaDays: number | null;
}) {
  const [displayNet, setDisplayNet] = useState(0);
  const [displayDays, setDisplayDays] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setDisplayNet(Math.round(netEur * eased));
      setDisplayDays(Math.round(currentDays * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netEur, currentDays]);

  const showConfetti = isRecord || (streakIsNew && streak > 0 && streak % 5 === 0);
  const confettiPieces = useMemo(() => {
    if (!showConfetti) return [];
    const colors = ["#ff7f00", "#ffd479", "#ffffff", "#c7d2fe"];
    return Array.from({ length: 18 }, (_, i) => ({
      left: `${(i * 53) % 100}%`,
      delay: `${(i % 6) * 0.09}s`,
      color: colors[i % colors.length],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfetti]);

  const ringProgress = goalDays > 0 ? Math.min(1, currentDays / goalDays) : 0;
  const ringOffset = 1 - ringProgress;

  return (
    <div
      className="owner-hero"
      style={{ ["--owner-ring-offset" as string]: ringOffset }}
    >
      {showConfetti &&
        confettiPieces.map((p, i) => (
          <span
            key={i}
            className="owner-confetti-piece"
            style={{ left: p.left, animationDelay: p.delay, background: p.color }}
          />
        ))}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Neto zarada — {monthLabel}
          </span>
          <div className="owner-hero-value text-4xl sm:text-5xl font-bold tabular-nums mt-1">
            {displayNet} €
          </div>
          {deltaPct !== null && (
            <p className="text-sm text-white/80 mt-1">
              {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}% u odnosu na prošli mjesec
            </p>
          )}
          {yoyDeltaDays !== null && (
            <p className="text-xs text-white/60 mt-0.5">
              {yoyDeltaDays >= 0
                ? `${yoyDeltaDays} dana više zauzeto nego isti mjesec prošle godine`
                : `${Math.abs(yoyDeltaDays)} dana manje zauzeto nego isti mjesec prošle godine`}
            </p>
          )}
        </div>

        {streak > 0 && (
          <span className={"owner-streak-badge" + (streakIsNew ? "" : " owner-streak-badge-light")}>
            🔥 {streak} {streak === 1 ? "dan zaredom" : "dana zaredom"}
          </span>
        )}
      </div>

      {isRecord && (
        <p className="mt-3 text-sm font-semibold bg-white/15 backdrop-blur-sm rounded-lg px-3 py-2 inline-block">
          🎉 Najbolji mjesec dosad!
        </p>
      )}

      <div className="mt-5 flex items-center gap-4">
        <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0" role="img" aria-label="Napredak cilja dana">
          <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="5" />
          <circle
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={1}
            className="owner-ring-progress"
            transform="rotate(-90 28 28)"
          />
          <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">
            {displayDays}
          </text>
        </svg>
        <div className="flex-1 min-w-[140px]">
          <div className="flex items-center justify-between text-xs text-white/80 mb-1">
            <span>Cilj dana zauzeća ovaj mjesec</span>
            <span className="tabular-nums">
              {currentDays}/{goalDays}
            </span>
          </div>
          <div className="owner-goal-track">
            <div
              className="owner-goal-fill"
              style={{ width: `${Math.round(ringProgress * 100)}%`, background: "rgba(255,255,255,0.85)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

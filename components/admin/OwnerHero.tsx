"use client";

import { useEffect, useMemo, useState } from "react";
import { refreshOwnerLoginStreakAction } from "@/lib/actions";
import OwnerGoalEditor from "@/components/admin/OwnerGoalEditor";

/**
 * "Naslovna" kartica vlasničkog dashboarda (app/admin/page.tsx OwnerDashboard)
 * — inspirirano Netflixovom velikom "hero" karticom (jedna dramatična brojka
 * na vrhu), Duolingovim streakom i ciljem dana (loss aversion + napredak),
 * i Instagram/TikTok "story ring" prstenom oko ključne brojke. "Liquid
 * glass" izgled preko NOVO gradient podloge (navy → ljubičasta → orange,
 * vidi globals.css .owner-hero) — staklo je SLOJ preko postojećeg branda,
 * ne zamjena za njega.
 *
 * Mobilno: label+broj i streak bedž se prisilno slažu okomito ispod ~420px
 * (.owner-hero-top u globals.css) umjesto neugodnog omatanja jedno pored
 * drugog na uskim ekranima.
 *
 * Animacije (count-up, konfeti, crtanje prstena) su čisti CSS/JS bez
 * biblioteka — zato "use client" (treba useEffect za requestAnimationFrame
 * count-up).
 *
 * Streak "bump" NAMJERNO nije dio server-rendera (vidi app/admin/page.tsx
 * OwnerDashboard) — poziva se ovdje, u useEffectu nakon mounta, preko
 * refreshOwnerLoginStreakAction (lib/actions.ts). Server Komponente se u
 * Next.js-u znaju izvršiti više puta po zahtjevu (RSC payload + prefetch),
 * pa PISANJE u bazu usred renderiranja može proizvesti dva različita HTML-a
 * za isti zahtjev → React hydration greška (#418) koju smo vidjeli na /admin
 * za vlasnika. `initialStreak` je čisto ČITANJE (admin.loginStreakCount,
 * bez pisanja) pa je server-render uvijek deterministički; stvarni bump se
 * potvrđuje tek ovdje, na klijentu, kad je stranica već hidrirana — ako se
 * broj promijeni, badge/prsten se vidljivo "diže" (dodatni addictive efekt,
 * slično Duolingovoj animaciji streaka). Isti princip vrijedi za cilj dana:
 * `autoGoalDays`/`initialCustomGoalDays` su čisto čitanje, a stvarna
 * promjena ide preko OwnerGoalEditor → server akcija, nikad ovdje u render
 * putu. */
export default function OwnerHero({
  monthLabel,
  netEur,
  deltaPct,
  isRecord,
  initialStreak,
  autoGoalDays,
  initialCustomGoalDays,
  currentDays,
  yoyDeltaDays,
}: {
  monthLabel: string;
  netEur: number;
  /** % promjena neto zarade vs prethodni mjesec, null ako nema podataka za usporedbu. */
  deltaPct: number | null;
  /** Je li ovo najbolji mjesec ikad (po neto zaradi) — pokreće konfeti + banner. */
  isRecord: boolean;
  /** Streak PRIJE današnjeg bumpa (admin.loginStreakCount) — samo čitanje, vidi gore. */
  initialStreak: number;
  /** Auto-izračunati cilj (70% dana u mjesecu) — koristi se kad vlasnik nema ručni cilj. */
  autoGoalDays: number;
  /** Vlasnikov ručni cilj (admin.customGoalDays), null = koristi autoGoalDays. */
  initialCustomGoalDays: number | null;
  currentDays: number;
  /** Razlika dana zauzeća vs isti mjesec prošle godine, null ako nema podataka. */
  yoyDeltaDays: number | null;
}) {
  const [displayNet, setDisplayNet] = useState(0);
  const [displayDays, setDisplayDays] = useState(0);
  const [streak, setStreak] = useState(initialStreak);
  const [streakIsNew, setStreakIsNew] = useState(false);
  const [goalDays, setGoalDays] = useState(initialCustomGoalDays ?? autoGoalDays);

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

  useEffect(() => {
    let cancelled = false;
    refreshOwnerLoginStreakAction()
      .then((result) => {
        if (cancelled) return;
        setStreak(result.streak);
        setStreakIsNew(result.isNewToday);
      })
      .catch(() => {
        // Best-effort — ako akcija ne uspije, ostaje prikazan initialStreak
        // (jučerašnje stanje), dashboard i dalje normalno radi.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      className="owner-hero owner-glass-grain"
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

      <div className="owner-hero-top">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Neto zarada — {monthLabel}
          </span>
          <div className="owner-hero-value font-bold tabular-nums mt-1">
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
          <span className={"owner-streak-badge" + (streakIsNew ? " owner-streak-badge-new" : "")}>
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
            <div className="flex items-center gap-2">
              <span className="tabular-nums">
                {currentDays}/{goalDays}
              </span>
              <OwnerGoalEditor
                autoGoalDays={autoGoalDays}
                initialCustomGoalDays={initialCustomGoalDays}
                onOptimisticChange={setGoalDays}
              />
            </div>
          </div>
          <div className="owner-goal-track">
            <div
              className="owner-goal-fill"
              style={{ width: `${Math.round(ringProgress * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

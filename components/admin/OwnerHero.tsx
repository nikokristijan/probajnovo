"use client";

import { useEffect, useState } from "react";
import OwnerGoalEditor from "@/components/admin/OwnerGoalEditor";

/**
 * "Naslovna" kartica vlasničkog dashboarda (app/admin/page.tsx OwnerDashboard)
 * — jedna dramatična brojka (neto zarada) + prsten napretka prema cilju
 * dana zauzeća. NOVO/Revolut redizajn (na izričit zahtjev, "achievementi
 * nisu potrebni, sve beskorisne stvari izbaci"): raniji Duolingo-stil
 * streak bedž + konfeti su UKLONJENI (loginStreakCount se više nigdje ne
 * čita/prikazuje ovdje) — ostaju samo stvarno korisni brojevi: zarada,
 * promjena vs prošli mjesec/prošla godina, i cilj dana. "Najbolji mjesec"
 * i dalje dobiva tih flat .na-chip umjesto proslavne trake — činjenica,
 * ne "unlock".
 *
 * Count-up animacija broja i crtanje prstena ostaju (mirni, informativni
 * efekti, ne gamifikacija) — zato i dalje "use client".
 */
export default function OwnerHero({
  monthLabel,
  netEur,
  deltaPct,
  isRecord,
  autoGoalDays,
  initialCustomGoalDays,
  currentDays,
  yoyDeltaDays,
}: {
  monthLabel: string;
  netEur: number;
  /** % promjena neto zarade vs prethodni mjesec, null ako nema podataka za usporedbu. */
  deltaPct: number | null;
  /** Je li ovo najbolji mjesec ikad (po neto zaradi) — prikazuje tihu oznaku, bez proslave. */
  isRecord: boolean;
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
  }, [netEur, currentDays]);

  const ringProgress = goalDays > 0 ? Math.min(1, currentDays / goalDays) : 0;
  const ringOffset = 1 - ringProgress;

  return (
    <div
      className="owner-hero owner-glass-grain"
      style={{ ["--owner-ring-offset" as string]: ringOffset }}
    >
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

        {isRecord && (
          <span className="na-chip" style={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff" }}>
            Najbolji mjesec dosad
          </span>
        )}
      </div>

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

export type OwnerBadgeStats = {
  streak: number;
  isRecord: boolean;
  currentDays: number;
  goalDays: number;
  deltaPct: number | null;
  yoyDeltaDays: number | null;
};

type Badge = {
  id: string;
  icon: string;
  label: string;
  hint: string;
  unlocked: boolean;
};

/**
 * Bedževi/postignuća (Duolingo-stil) za vlasnički dashboard — NAMJERNO
 * čista funkcija već izračunatih statistika (vidi app/admin/page.tsx
 * OwnerDashboard), BEZ ikakvog čitanja/pisanja u bazu i bez "unlocked"
 * stanja koje bi trebalo perzistirati. Ista statistika uvijek daje isti
 * skup bedževa na svakom renderu — nema prostora za utrku dviju izvedbi
 * render funkcije koja je uzrokovala hydration grešku #418 (vidi
 * lib/actions.ts refreshOwnerLoginStreakAction). Server komponenta, bez
 * "use client" — nema interaktivnosti, samo prikaz.
 */
export function computeOwnerBadges(stats: OwnerBadgeStats): Badge[] {
  const { streak, isRecord, currentDays, goalDays, deltaPct, yoyDeltaDays } = stats;

  const streakTier =
    streak >= 30 ? { n: 30, label: "30 dana zaredom" } :
    streak >= 7 ? { n: 7, label: "7 dana zaredom" } :
    streak >= 3 ? { n: 3, label: "3 dana zaredom" } :
    { n: 3, label: "3 dana zaredom" };

  return [
    {
      id: "streak",
      icon: "🔥",
      label: streakTier.label,
      hint: streak >= streakTier.n ? "Otvaraj dashboard svaki dan da zadržiš niz." : `Otvori dashboard ${streakTier.n} dana zaredom.`,
      unlocked: streak >= streakTier.n,
    },
    {
      id: "goal",
      icon: "🎯",
      label: "Cilj ostvaren",
      hint: currentDays >= goalDays ? "Ostvario si ovomjesečni cilj zauzeća." : `Još ${Math.max(0, goalDays - currentDays)} dana do cilja.`,
      unlocked: goalDays > 0 && currentDays >= goalDays,
    },
    {
      id: "record",
      icon: "🏆",
      label: "Rekordni mjesec",
      hint: isRecord ? "Ovo je tvoj najbolji mjesec dosad!" : "Nadmaši svoj najbolji dosadašnji mjesec.",
      unlocked: isRecord,
    },
    {
      id: "trend",
      icon: "📈",
      label: "U usponu",
      hint: deltaPct !== null && deltaPct > 0 ? "Zarada raste u odnosu na prošli mjesec." : "Povećaj zaradu u odnosu na prošli mjesec.",
      unlocked: deltaPct !== null && deltaPct > 0,
    },
    {
      id: "yoy",
      icon: "🌟",
      label: "Bolje nego lani",
      hint: yoyDeltaDays !== null && yoyDeltaDays > 0 ? "Više dana zauzeto nego isti mjesec lani." : "Nadmaši isti mjesec prošle godine.",
      unlocked: yoyDeltaDays !== null && yoyDeltaDays > 0,
    },
  ];
}

export default function OwnerBadges({ stats }: { stats: OwnerBadgeStats }) {
  const badges = computeOwnerBadges(stats);
  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--od-ink-faint)" }}>
          Postignuća
        </h2>
        <span className="text-xs font-semibold" style={{ color: "var(--od-ink-faint)" }}>
          {unlockedCount}/{badges.length}
        </span>
      </div>
      <div className="owner-badges-row">
        {badges.map((b) => (
          <span
            key={b.id}
            title={b.hint}
            className={"owner-badge owner-glass-grain " + (b.unlocked ? "owner-badge-unlocked owner-badge-new" : "owner-badge-locked")}
          >
            <span className="owner-badge-icon">{b.unlocked ? b.icon : "🔒"}</span>
            {b.label}
          </span>
        ))}
      </div>
    </section>
  );
}

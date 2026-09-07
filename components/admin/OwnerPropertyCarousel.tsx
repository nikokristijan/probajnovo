import Link from "next/link";

type CarouselProperty = {
  id: number;
  name: string;
  images: string[];
};

/**
 * Vodoravno klizni red kartica vikendica (Netflix-stil "row") — samo kad
 * vlasnik ima VIŠE OD JEDNE vikendice (inače je suvišno, vlasnički dashboard
 * već pokazuje jedinu vikendicu posvuda drugdje). Svaka kartica vodi na
 * knjigu rezervacija te konkretne vikendice (?property=id, vidi
 * app/admin/rezervacije/page.tsx). Server komponenta — bez interaktivnosti
 * osim CSS scroll-snapa (.owner-carousel u globals.css), nije potreban
 * "use client".
 */
export default function OwnerPropertyCarousel({
  properties,
  breakdown,
  monthLabel,
}: {
  properties: CarouselProperty[];
  breakdown: Record<number, { daysBooked: number; netEur: number }>;
  monthLabel: string;
}) {
  if (properties.length < 2) return null;

  return (
    <section className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--od-ink-faint)" }}>
        Tvoje vikendice — {monthLabel}
      </span>
      <div className="owner-carousel">
        {properties.map((p) => {
          const stats = breakdown[p.id] ?? { daysBooked: 0, netEur: 0 };
          const cover = p.images[0];
          return (
            <Link
              key={p.id}
              href={`/admin/rezervacije?property=${p.id}`}
              className="owner-glass owner-glass-interactive w-[220px] rounded-2xl overflow-hidden"
            >
              <div
                className="h-28 w-full bg-cover bg-center"
                style={{
                  backgroundColor: "rgba(120,120,150,0.12)",
                  ...(cover ? { backgroundImage: `url(${cover})` } : {}),
                }}
              />
              <div className="p-3 flex flex-col gap-1.5">
                <span className="text-sm font-semibold truncate" style={{ color: "var(--od-ink)" }}>
                  {p.name}
                </span>
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--od-ink-faint)" }}>
                  <span>{stats.daysBooked} dana zauzeto</span>
                  <span className="font-semibold tabular-nums" style={{ color: "var(--od-ink-soft)" }}>
                    {stats.netEur} €
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

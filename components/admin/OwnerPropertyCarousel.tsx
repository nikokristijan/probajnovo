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
      <span className="text-xs font-semibold uppercase tracking-wide text-black/40">
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
              className="w-[220px] rounded-xl overflow-hidden border border-black/10 bg-white hover:border-black/25 transition-colors"
            >
              <div
                className="h-28 w-full bg-black/5 bg-cover bg-center"
                style={cover ? { backgroundImage: `url(${cover})` } : undefined}
              />
              <div className="p-3 flex flex-col gap-1.5">
                <span className="text-sm font-semibold truncate">{p.name}</span>
                <div className="flex items-center justify-between text-xs text-black/50">
                  <span>{stats.daysBooked} dana zauzeto</span>
                  <span className="font-semibold text-black/70 tabular-nums">{stats.netEur} €</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listPropertiesForAdmin, listBlockedDates } from "@/lib/db/queries";
import { toggleBlockedDateAction, blockDateRangeAction } from "@/lib/actions";

const MONTH_NAMES = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];
const WEEKDAY_LABELS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Ponedjeljkom počinje tjedan (hrvatski standard) — JS getDay() vraća 0=nedjelja. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; year?: string; month?: string }>;
}) {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");

  const properties = await listPropertiesForAdmin(admin);
  const sp = await searchParams;

  if (properties.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">Kalendar</h1>
        <p className="text-sm text-black/60">
          {admin.role === "owner"
            ? "Nemaš dodijeljenu nijednu vikendicu — javi se glavnom adminu."
            : "Još nema dodanih vikendica."}
        </p>
      </div>
    );
  }

  const selectedId = sp.property ? Number(sp.property) : properties[0].id;
  const property = properties.find((p) => p.id === selectedId) ?? properties[0];

  const now = new Date();
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1; // 1-12

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const leadingBlanks = mondayIndex(firstOfMonth);

  const blocked = await listBlockedDates(property.id);
  const blockedByDate = new Map(blocked.map((b) => [b.date, b.source]));

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const linkFor = (params: { property?: number; year?: number; month?: number }) => {
    const q = new URLSearchParams();
    q.set("property", String(params.property ?? property.id));
    q.set("year", String(params.year ?? year));
    q.set("month", String(params.month ?? month));
    return `/admin/kalendar?${q.toString()}`;
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* Naslov uvijek uključuje ime vikendice (ne samo generički "Kalendar
            dostupnosti") — jasno je čiji je kalendar i kad admin/vlasnik ima
            samo jednu vikendicu, ne samo kad ih ima više i vidi se selektor
            ispod. */}
        <h1 className="text-xl font-bold">{property.name} — kalendar dostupnosti</h1>
        <p className="text-xs text-black/50 mt-0.5">
          Klikni na dan da ga označiš zauzetim/slobodnim. Dani povučeni automatski iz
          Booking.com/Airbnb (oznaka &bdquo;iCal&rdquo;) se ne mogu ručno deblokirati ovdje.
        </p>
      </div>

      {properties.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={linkFor({ property: p.id, year: now.getFullYear(), month: now.getMonth() + 1 })}
              className={
                "text-xs font-semibold px-3 py-1.5 rounded-full border " +
                (p.id === property.id
                  ? "bg-black text-white border-black"
                  : "border-black/15 hover:border-black/40")
              }
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}

      <div className="border border-black/10 rounded-xl p-5 bg-white max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <Link href={linkFor({ year: prevYear, month: prevMonth })} className="admin-quicklink">
            ← Prošli
          </Link>
          <span className="font-semibold text-sm">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Link href={linkFor({ year: nextYear, month: nextMonth })} className="admin-quicklink">
            Sljedeći →
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} className="text-[11px] font-semibold text-black/40 py-1">
              {w}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`blank-${i}`} />;
            const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
            const source = blockedByDate.get(dateStr);
            const isBlocked = !!source;
            const isIcal = source === "ical";

            if (isIcal) {
              return (
                <div
                  key={dateStr}
                  title="Automatski povučeno (iCal) — ne može se ručno deblokirati ovdje"
                  className="aspect-square rounded-lg text-xs font-semibold flex items-center justify-center bg-black/70 text-white"
                >
                  {day}
                </div>
              );
            }

            return (
              <form key={dateStr} action={toggleBlockedDateAction.bind(null, property.id, dateStr, isBlocked)}>
                <button
                  type="submit"
                  className={
                    "aspect-square w-full rounded-lg text-xs font-semibold transition-colors " +
                    (isBlocked
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-black/5 hover:bg-black/10")
                  }
                >
                  {day}
                </button>
              </form>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 text-[11px] text-black/50">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-black/5 border border-black/10 inline-block" />
            slobodno
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            ručno blokirano
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-black/70 inline-block" />
            iCal (auto)
          </span>
        </div>
      </div>

      {/* Blokiranje cijelog raspona odjednom — umjesto klikanja dan po dan
          gore, npr. za cijeli tjedan rezervacije unesene izvan sustava. */}
      <form
        action={blockDateRangeAction.bind(null, property.id, linkFor({}))}
        className="border border-black/10 rounded-xl p-5 bg-white max-w-xl flex flex-col gap-3"
      >
        <span className="text-sm font-semibold">Blokiraj raspon datuma</span>
        <p className="text-xs text-black/50 -mt-2">
          Označi cijeli raspon zauzetim odjednom (npr. tjedan rezerviran telefonom), umjesto
          klikanja svakog dana posebno gore.
        </p>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
            Od
            <input type="date" name="start" required className="admin-input" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
            Do
            <input type="date" name="end" required className="admin-input" />
          </label>
          <button
            type="submit"
            className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2 h-fit"
          >
            Blokiraj
          </button>
        </div>
      </form>
    </div>
  );
}

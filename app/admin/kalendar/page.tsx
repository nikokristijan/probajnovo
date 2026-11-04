import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listPropertiesForAdmin, listBlockedDates, listReservationsForProperty } from "@/lib/db/queries";
import { toggleBlockedDateAction, blockDateRangeAction } from "@/lib/actions";
import { toggleUnitBlockedDateAction, blockUnitDateRangeAction } from "@/lib/actions-units";
import { getPropertyExtrasSafe, listUnitBlockedDates, type UnitBlockedRow } from "@/lib/db/units";
import { currentYearMonthZagreb } from "@/lib/date";

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

type Theme = "owner" | "admin";
/** Jedna ćelija kalendara: "free"/"manual" se mogu kliknuti, ostalo je samo za čitanje. */
type CellInfo =
  | { kind: "free" }
  | { kind: "manual" }
  | { kind: "ical"; title: string }
  | { kind: "reservation"; title: string }
  | { kind: "shared"; source: string; title: string };

const CLS: Record<Theme, Record<"free" | "manual" | "ical" | "reservation", string>> = {
  owner: {
    free: "owner-cal-cell-btn owner-cal-cell-free",
    manual: "owner-cal-cell-btn owner-cal-cell-blocked",
    ical: "owner-cal-cell-btn owner-cal-cell-ical",
    reservation: "owner-cal-cell-btn owner-cal-cell-reservation",
  },
  admin: {
    free: "aspect-square w-full rounded-lg bg-black/5 hover:bg-black/10 transition-colors",
    manual: "aspect-square w-full rounded-lg bg-black/25 text-black/85 hover:bg-black/35 transition-colors",
    ical: "aspect-square rounded-lg flex items-center justify-center border-[1.5px] border-dashed border-black/50 bg-black/[0.03]",
    reservation: "aspect-square rounded-lg flex items-center justify-center bg-[#0000c3] text-white",
  },
};

/**
 * Mreža jednog mjeseca. `cellFor` kaže kakav je dan, `toggle` vraća server
 * akciju za klik (ručno blokiraj/odblokiraj) — ista mreža služi i za cijeli
 * objekt i za svaki apartman posebno.
 */
function MonthGrid({
  theme,
  year,
  month,
  cellFor,
  toggle,
}: {
  theme: Theme;
  year: number;
  month: number;
  cellFor: (dateStr: string) => CellInfo;
  toggle: (dateStr: string, isBlocked: boolean) => () => Promise<void>;
}) {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: mondayIndex(firstOfMonth) }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const cls = CLS[theme];
  return (
    <div className="grid grid-cols-7 gap-1.5 text-center">
      {WEEKDAY_LABELS.map((w) => (
        <div
          key={w}
          className={"text-[11px] font-semibold py-1" + (theme === "admin" ? " text-black/40" : "")}
          style={theme === "owner" ? { color: "var(--od-ink-faint)" } : undefined}
        >
          {w}
        </div>
      ))}
      {cells.map((day, i) => {
        if (day === null) return <div key={`blank-${i}`} />;
        const dateStr = `${year}-${pad2(month)}-${pad2(day)}`;
        const info = cellFor(dateStr);
        if (info.kind === "free" || info.kind === "manual") {
          const isBlocked = info.kind === "manual";
          return (
            <form key={dateStr} action={toggle(dateStr, isBlocked)}>
              <button type="submit" className={"text-xs font-semibold " + cls[info.kind]}>
                {day}
              </button>
            </form>
          );
        }
        const visual =
          info.kind === "shared"
            ? info.source === "reservation"
              ? cls.reservation
              : info.source === "ical"
                ? cls.ical
                : cls.manual
            : cls[info.kind];
        return (
          <div
            key={dateStr}
            title={info.title}
            className={"text-xs font-semibold " + visual + (info.kind === "shared" ? " opacity-60" : "")}
            style={{ cursor: "default" }}
          >
            {day}
          </div>
        );
      })}
    </div>
  );
}

function Legend({ theme, withShared }: { theme: Theme; withShared?: boolean }) {
  const owner = theme === "owner";
  const dot = (cls: string) => <span className={"w-2.5 h-2.5 rounded-full inline-block " + cls} />;
  return (
    <div
      className={"flex items-center gap-4 mt-4 text-[11px] flex-wrap" + (owner ? "" : " text-black/65")}
      style={owner ? { color: "var(--od-ink-soft)" } : undefined}
    >
      <span className="flex items-center gap-1.5">{dot(owner ? "owner-cal-cell-free" : "bg-black/5 border border-black/10")}slobodno</span>
      <span className="flex items-center gap-1.5">{dot(owner ? "owner-cal-cell-blocked" : "bg-black/25")}ručno blokirano</span>
      <span className="flex items-center gap-1.5">{dot(owner ? "owner-cal-cell-ical" : "border border-dashed border-black/50")}Booking/Airbnb (iCal)</span>
      <span className="flex items-center gap-1.5">{dot(owner ? "owner-cal-cell-reservation" : "bg-[#0000c3]")}rezervacija</span>
      {withShared && <span className="flex items-center gap-1.5 opacity-80">prigušeno = blokirano za cijeli objekt</span>}
    </div>
  );
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; year?: string; month?: string; scope?: string }>;
}) {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");

  const properties = await listPropertiesForAdmin(admin);
  const sp = await searchParams;
  const owner = admin.role === "owner";
  const theme: Theme = owner ? "owner" : "admin";

  if (properties.length === 0) {
    return (
      <div className={(owner ? "owner-dash " : "") + "flex flex-col gap-2"} data-theme={owner ? admin.themePreference ?? "system" : undefined}>
        <h1 className="text-xl font-bold">Kalendar</h1>
        <p className={"text-sm" + (owner ? "" : " text-black/60")} style={owner ? { color: "var(--od-ink-soft)" } : undefined}>
          {owner ? "Nemaš dodijeljenu nijednu vikendicu — javi se glavnom adminu." : "Još nema dodanih vikendica."}
        </p>
      </div>
    );
  }

  const selectedId = sp.property ? Number(sp.property) : properties[0].id;
  const property = properties.find((p) => p.id === selectedId) ?? properties[0];

  const nowZagreb = currentYearMonthZagreb();
  const year = sp.year ? Number(sp.year) : nowZagreb.year;
  const month = sp.month ? Number(sp.month) : nowZagreb.month; // 1-12

  const [blocked, reservations, extras] = await Promise.all([
    listBlockedDates(property.id),
    listReservationsForProperty(property.id),
    getPropertyExtrasSafe(property.id),
  ]);
  const units = extras.units;
  const scope = units.length > 0 && sp.scope !== "property" ? "units" : "property";
  let unitRows: UnitBlockedRow[] = [];
  if (scope === "units") {
    try {
      unitRows = await listUnitBlockedDates(property.id);
    } catch (err) {
      console.error("[AdminCalendarPage] listUnitBlockedDates nije uspio:", err);
    }
  }

  const blockedByDate = new Map(blocked.map((b) => [b.date, b]));
  // Ime gosta za tooltip na rezervacijom-blokiranim danima (source "reservation").
  const guestNameByReservationId = new Map(reservations.map((r) => [r.id, r.guestName]));

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const linkFor = (params: { property?: number; year?: number; month?: number; scope?: string }) => {
    const q = new URLSearchParams();
    q.set("property", String(params.property ?? property.id));
    q.set("year", String(params.year ?? year));
    q.set("month", String(params.month ?? month));
    const s = params.scope ?? (params.property && params.property !== property.id ? undefined : sp.scope);
    if (s === "property") q.set("scope", "property");
    return `/admin/kalendar?${q.toString()}`;
  };

  const propertyCell = (dateStr: string): CellInfo => {
    const row = blockedByDate.get(dateStr);
    if (!row) return { kind: "free" };
    if (row.source === "ical") return { kind: "ical", title: "Automatski povučeno (iCal) — ne može se ručno deblokirati ovdje" };
    if (row.source === "reservation") {
      const guestName = row.reservationId != null ? guestNameByReservationId.get(row.reservationId) : null;
      return {
        kind: "reservation",
        title: (guestName ? `${guestName} — ` : "") + "iz rezervacije — ne može se ručno deblokirati ovdje, obriši rezervaciju",
      };
    }
    return { kind: "manual" };
  };

  const unitCell = (unitSlug: string) => {
    const own = new Map(unitRows.filter((r) => r.unitSlug === unitSlug).map((r) => [r.date, r.source]));
    return (dateStr: string): CellInfo => {
      const src = own.get(dateStr);
      if (src === "ical") return { kind: "ical", title: "Automatski povučeno (iCal ovog apartmana)" };
      if (src) return { kind: "manual" };
      const shared = blockedByDate.get(dateStr);
      if (shared) {
        return {
          kind: "shared",
          source: shared.source,
          title: "Blokirano za cijeli objekt (oba apartmana) — uredi u prikazu „Cijeli objekt”",
        };
      }
      return { kind: "free" };
    };
  };

  const card = owner ? "owner-glass owner-glass-grain rounded-2xl p-5" : "border border-black/10 rounded-xl p-5 bg-white";
  const navLink = owner ? "owner-quicklink" : "admin-quicklink";
  const softText = owner ? undefined : "text-black/50";
  const softStyle = owner ? { color: "var(--od-ink-faint)" } : undefined;
  const pill = (active: boolean) =>
    owner
      ? "owner-quicklink" + (active ? " owner-quicklink-active" : "")
      : "text-xs font-semibold px-3 py-1.5 rounded-full border " +
        (active ? "bg-black text-white border-black" : "border-black/15 hover:border-black/40");
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const monthNav = (
    <div className="flex items-center justify-between gap-3">
      <Link href={linkFor({ year: prevYear, month: prevMonth })} className={navLink}>
        ← Prošli
      </Link>
      <span className="font-semibold text-sm">{monthLabel}</span>
      <Link href={linkFor({ year: nextYear, month: nextMonth })} className={navLink}>
        Sljedeći →
      </Link>
    </div>
  );

  const content = (
    <>
      <div>
        <h1 className="text-xl font-bold">
          {property.name} — {scope === "units" ? "kalendari apartmana" : "kalendar dostupnosti"}
        </h1>
        <p className={"text-xs mt-0.5 " + (softText ?? "")} style={softStyle}>
          {scope === "units"
            ? "Svaki apartman ima svoj kalendar — klikni na dan da ga označiš zauzetim/slobodnim samo za taj apartman. Ovi kalendari se prikazuju i gostima na stranici svakog apartmana."
            : "Klikni na dan da ga označiš zauzetim/slobodnim."}{" "}
          Dani povučeni automatski iz Booking.com/Airbnb (iCal) i dani iz{" "}
          <Link href={`/admin/rezervacije?property=${property.id}`} className="underline">
            rezervacija
          </Link>{" "}
          se ne mogu ručno deblokirati ovdje.
        </p>
      </div>

      {properties.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => (
            <Link key={p.id} href={linkFor({ property: p.id, year: nowZagreb.year, month: nowZagreb.month })} className={pill(p.id === property.id)}>
              {p.name}
            </Link>
          ))}
        </div>
      )}

      {units.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link href={linkFor({ scope: "units" })} className={pill(scope === "units")}>
            Apartmani ({units.length})
          </Link>
          <Link href={linkFor({ scope: "property" })} className={pill(scope === "property")}>
            Cijeli objekt
          </Link>
        </div>
      )}

      {scope === "units" ? (
        <>
          <div className={card + " max-w-5xl"}>{monthNav}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl">
            {units.map((u) => (
              <div key={u.slug} className={card}>
                <div className="flex items-baseline justify-between gap-3 mb-4">
                  <span className="font-semibold text-sm">{u.name}</span>
                  <span className={"text-[11px] " + (softText ?? "")} style={softStyle}>
                    {monthLabel}
                  </span>
                </div>
                <MonthGrid
                  theme={theme}
                  year={year}
                  month={month}
                  cellFor={unitCell(u.slug)}
                  toggle={(dateStr, isBlocked) => toggleUnitBlockedDateAction.bind(null, property.id, u.slug, dateStr, isBlocked)}
                />
                <Legend theme={theme} withShared={blocked.length > 0} />
              </div>
            ))}
          </div>

          <form action={blockUnitDateRangeAction.bind(null, property.id, linkFor({}))} className={card + " max-w-xl flex flex-col gap-3"}>
            <span className="text-sm font-semibold">Blokiraj raspon datuma</span>
            <p className={"text-xs -mt-2 " + (softText ?? "")} style={softStyle}>
              Označi cijeli raspon zauzetim odjednom (npr. tjedan rezerviran telefonom) za jedan ili oba apartmana.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Apartman
                <select name="unit" className={owner ? "owner-input" : "admin-input"} defaultValue={units[0]?.slug}>
                  {units.map((u) => (
                    <option key={u.slug} value={u.slug}>
                      {u.name}
                    </option>
                  ))}
                  {units.length > 1 && <option value="__all__">Svi apartmani</option>}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Od
                <input type="date" name="start" required className={owner ? "owner-input" : "admin-input"} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Do
                <input type="date" name="end" required className={owner ? "owner-input" : "admin-input"} />
              </label>
              <button type="submit" className={owner ? "owner-btn-primary h-fit" : "rounded-full bg-black text-white text-sm font-semibold px-4 py-2 h-fit"}>
                Blokiraj
              </button>
            </div>
          </form>
        </>
      ) : (
        <>
          <div className={card + " max-w-xl"}>
            <div className="mb-4">{monthNav}</div>
            <MonthGrid
              theme={theme}
              year={year}
              month={month}
              cellFor={propertyCell}
              toggle={(dateStr, isBlocked) => toggleBlockedDateAction.bind(null, property.id, dateStr, isBlocked)}
            />
            <Legend theme={theme} />
          </div>

          {/* Blokiranje cijelog raspona odjednom — umjesto klikanja dan po dan. */}
          <form action={blockDateRangeAction.bind(null, property.id, linkFor({}))} className={card + " max-w-xl flex flex-col gap-3"}>
            <span className="text-sm font-semibold">Blokiraj raspon datuma{units.length > 0 ? " (cijeli objekt)" : ""}</span>
            <p className={"text-xs -mt-2 " + (softText ?? "")} style={softStyle}>
              Označi cijeli raspon zauzetim odjednom (npr. tjedan rezerviran telefonom), umjesto klikanja svakog dana posebno gore.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Od
                <input type="date" name="start" required className={owner ? "owner-input" : "admin-input"} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium">
                Do
                <input type="date" name="end" required className={owner ? "owner-input" : "admin-input"} />
              </label>
              <button type="submit" className={owner ? "owner-btn-primary h-fit" : "rounded-full bg-black text-white text-sm font-semibold px-4 py-2 h-fit"}>
                Blokiraj
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );

  // Vlasnik dobiva liquid-glass temu (.owner-* klase u globals.css), puni admin
  // zadržava jednostavan bijeli izgled.
  if (owner) {
    return (
      <div className="owner-dash flex flex-col gap-6" data-theme={admin.themePreference ?? "system"}>
        {content}
      </div>
    );
  }
  return <div className="flex flex-col gap-6">{content}</div>;
}

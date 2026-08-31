import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  listPropertiesForAdmin,
  listReservationsForProperty,
  listExpensesForProperty,
  getMonthlyEarnings,
} from "@/lib/db/queries";
import ReservationForm from "@/components/admin/ReservationForm";
import ReservationsTable from "@/components/admin/ReservationsTable";
import ExpenseForm from "@/components/admin/ExpenseForm";
import DeleteExpenseButton from "@/components/admin/DeleteExpenseButton";
import { currentYearMonthZagreb } from "@/lib/date";

const MONTH_NAMES = [
  "Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj",
  "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac",
];

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });
}

function EarningsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-black/10 rounded-xl px-4 py-3 bg-white">
      <div className="text-2xl font-bold tabular-nums">{value} €</div>
      <div className="text-xs text-black/50 mt-0.5">{label}</div>
    </div>
  );
}

/**
 * Puna knjiga rezervacija po vikendici — zamjena za vlasnikovu bilježnicu
 * (vidi task #73-79). Za svaku vikendicu: unos gosta/datuma/cijene/statusa
 * plaćanja, automatsko blokiranje kalendara (vidi lib/db/queries.ts
 * createReservation), zarada po mjesecu (samo plaćene rezervacije čiji je
 * datum dolaska u tom mjesecu, vidi getMonthlyEarnings) i opcionalni
 * troškovi za neto zaradu.
 */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; year?: string; month?: string; overlap?: string }>;
}) {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");

  const properties = await listPropertiesForAdmin(admin);
  const sp = await searchParams;

  if (properties.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">Rezervacije</h1>
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
  const redirectTo = `/admin/rezervacije?property=${property.id}`;

  const [reservations, expenses] = await Promise.all([
    listReservationsForProperty(property.id),
    listExpensesForProperty(property.id),
  ]);

  // Mjesec za koji se prikazuje zarada — podrazumijevano tekući, ali
  // navigacija ← → (linkFor ispod) omogućuje pregled bilo kojeg mjeseca, ne
  // samo trenutnog (isti obrazac kao app/admin/kalendar).
  const nowZagreb = currentYearMonthZagreb();
  const year = sp.year ? Number(sp.year) : nowZagreb.year;
  const month = sp.month ? Number(sp.month) : nowZagreb.month; // 1-12
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;
  const isCurrentMonth = year === nowZagreb.year && month === nowZagreb.month;
  const earnings = await getMonthlyEarnings([property.id], monthPrefix);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthLinkFor = (y: number, m: number) =>
    `/admin/rezervacije?property=${property.id}&year=${y}&month=${m}`;

  const overlapCount = sp.overlap ? Number(sp.overlap) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">{property.name} — rezervacije</h1>
        <p className="text-xs text-black/50 mt-0.5">
          Puna knjiga rezervacija — gost, datumi, cijena i status plaćanja umjesto bilježnice.
          Nova rezervacija automatski blokira noćenja u{" "}
          <Link href={`/admin/kalendar?property=${property.id}`} className="underline">
            kalendaru
          </Link>
          .
        </p>
      </div>

      {properties.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/admin/rezervacije?property=${p.id}`}
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

      {overlapCount > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Upozorenje: {overlapCount}{" "}
          {overlapCount === 1 ? "od odabranih dana za ovu rezervaciju je" : "od odabranih dana za ovu rezervaciju su"}{" "}
          već bio zauzet prije spremanja (ručno, iCal ili druga rezervacija) — rezervacija je svejedno
          spremljena, provjeri{" "}
          <Link href={`/admin/kalendar?property=${property.id}`} className="underline">
            kalendar
          </Link>{" "}
          da nije došlo do dvostruke rezervacije.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Zarada — {MONTH_NAMES[month - 1]} {year}
          </span>
          <div className="flex items-center gap-2">
            <Link href={monthLinkFor(prevYear, prevMonth)} className="admin-quicklink">
              ← Prošli
            </Link>
            {!isCurrentMonth && (
              <Link
                href={`/admin/rezervacije?property=${property.id}`}
                className="text-xs font-semibold text-[#ff7f00]"
              >
                Ovaj mjesec
              </Link>
            )}
            <Link href={monthLinkFor(nextYear, nextMonth)} className="admin-quicklink">
              Sljedeći →
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <EarningsCard label="Naplaćeno (bruto)" value={earnings.grossEur} />
          <EarningsCard label="Troškovi" value={earnings.expensesEur} />
          <EarningsCard label="Neto zarada" value={earnings.netEur} />
        </div>
        <p className="text-xs text-black/40 -mt-1">
          Bruto broji samo PLAĆENE rezervacije čiji je datum dolaska gosta u ovom mjesecu — zarada
          prati kad gost stvarno boravi, bez obzira kad je označeno plaćeno.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
            Sve rezervacije
          </h2>
          {reservations.length > 0 && (
            <a
              href={`/api/admin/reservations/export?property=${property.id}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-black/15 hover:border-black/40"
            >
              Izvezi CSV
            </a>
          )}
        </div>
        <ReservationsTable propertyId={property.id} reservations={reservations} />
      </section>

      <ReservationForm propertyId={property.id} redirectTo={redirectTo} />

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Troškovi (opcionalno)
        </h2>
        <p className="text-xs text-black/50 -mt-2">
          Nije obavezno — unesi ih samo ako želiš da dashboard pokazuje i neto zaradu (bruto minus
          troškovi), npr. čišćenje ili održavanje.
        </p>
        {expenses.length > 0 && (
          <div className="flex flex-col gap-2">
            {expenses.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-2.5 bg-white"
              >
                <div>
                  <span className="font-semibold text-sm">{e.description}</span>
                  <span className="text-xs text-black/50 ml-2">{formatDate(e.date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums">{e.amountEur} €</span>
                  <DeleteExpenseButton propertyId={property.id} id={e.id} description={e.description} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ExpenseForm propertyId={property.id} redirectTo={redirectTo} />
    </div>
  );
}

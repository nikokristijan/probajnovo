import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  listPropertiesForAdmin,
  listReservationsForProperty,
  listExpensesForProperty,
  getMonthlyEarnings,
} from "@/lib/db/queries";
import { toggleReservationPaidAction } from "@/lib/actions";
import ReservationForm from "@/components/admin/ReservationForm";
import DeleteReservationButton from "@/components/admin/DeleteReservationButton";
import ExpenseForm from "@/components/admin/ExpenseForm";
import DeleteExpenseButton from "@/components/admin/DeleteExpenseButton";

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
 * createReservation), zarada ovaj mjesec (samo plaćene rezervacije, po
 * vlasnikovom pravilu) i opcionalni troškovi za neto zaradu.
 */
export default async function AdminReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
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

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const earnings = await getMonthlyEarnings([property.id], monthPrefix);

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

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <EarningsCard label={`Naplaćeno u ${MONTH_NAMES[now.getMonth()]}u (bruto)`} value={earnings.grossEur} />
        <EarningsCard label="Troškovi ovaj mjesec" value={earnings.expensesEur} />
        <EarningsCard label="Neto zarada ovaj mjesec" value={earnings.netEur} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
          Sve rezervacije
        </h2>
        {reservations.length === 0 ? (
          <p className="text-sm text-black/60">Još nema unesenih rezervacija za ovu vikendicu.</p>
        ) : (
          <div className="overflow-x-auto border border-black/10 rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-black/40 border-b border-black/10">
                  <th className="px-4 py-2.5 font-semibold">Gost</th>
                  <th className="px-4 py-2.5 font-semibold">Dolazak</th>
                  <th className="px-4 py-2.5 font-semibold">Odlazak</th>
                  <th className="px-4 py-2.5 font-semibold">Cijena</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Kontakt / napomena</th>
                  <th className="px-4 py-2.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="border-b border-black/5 last:border-0 align-top">
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{r.guestName}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkIn)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkOut)}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{r.priceEur} €</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <form action={toggleReservationPaidAction.bind(null, property.id, r.id, r.paid)}>
                        <button
                          type="submit"
                          className={
                            "text-[11px] font-semibold px-2.5 py-1 rounded-full " +
                            (r.paid
                              ? "bg-green-600/10 text-green-700"
                              : "bg-[#ff7f00]/10 text-[#ff7f00]")
                          }
                        >
                          {r.paid ? "Plaćeno" : "Čeka se"}
                        </button>
                      </form>
                    </td>
                    <td className="px-4 py-3 text-black/60 text-xs max-w-[220px]">
                      {[r.phone, r.email].filter(Boolean).join(" · ")}
                      {r.note && <div className="mt-1 whitespace-pre-wrap">{r.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DeleteReservationButton propertyId={property.id} id={r.id} guestName={r.guestName} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

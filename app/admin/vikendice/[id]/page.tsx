import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFullAdmin } from "@/lib/auth";
import {
  getPropertyById,
  listInquiries,
  listBlockedDates,
  listReservationsForProperty,
  getMonthlyEarnings,
  getPageViewCounts,
} from "@/lib/db/queries";
import { markInquiryReadAction, markInquiryRepliedAction } from "@/lib/actions";
import MiniCalendar from "@/components/admin/MiniCalendar";
import { currentYearMonthZagreb, todayDateStringZagreb, dateStringOffsetFromTodayZagreb } from "@/lib/date";

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="border border-black/10 rounded-xl px-4 py-3 bg-white">
      <div className="text-2xl font-bold tabular-nums">
        {value}
        {suffix ?? ""}
      </div>
      <div className="text-xs text-black/50 mt-0.5">{label}</div>
    </div>
  );
}

/**
 * Kontrolna soba JEDNE vikendice za pune admine — kalendar, rezervacije/
 * zarada i upiti baš za nju na jednom mjestu, umjesto tri zasebna
 * top-level taba koja su miješala sve vikendice. Vidi app/admin/vikendice
 * (popis) i app/admin/layout.tsx nav.
 */
export default async function AdminVikendicaHubPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFullAdmin();
  const { id } = await params;
  const propertyId = Number(id);

  const property = await getPropertyById(propertyId);
  if (!property) redirect("/admin/vikendice");

  const nowZagreb = currentYearMonthZagreb();
  const monthPrefix = `${nowZagreb.year}-${String(nowZagreb.month).padStart(2, "0")}`;
  const now = new Date(Date.UTC(nowZagreb.year, nowZagreb.month - 1, 1));

  const [allInquiries, blocked, reservations, earnings, pageViews] = await Promise.all([
    listInquiries(),
    listBlockedDates(propertyId),
    listReservationsForProperty(propertyId),
    getMonthlyEarnings([propertyId], monthPrefix),
    getPageViewCounts("property", propertyId, dateStringOffsetFromTodayZagreb(-30)),
  ]);
  const inquiries = allInquiries.filter((i) => i.source === "property" && i.sourceId === propertyId);
  const pendingCount = inquiries.filter((i) => !i.read).length;
  const recentInquiries = inquiries.slice(0, 3);
  const daysBookedThisMonth = blocked.filter((b) => b.date.startsWith(monthPrefix)).length;
  const today = todayDateStringZagreb();
  const upcomingReservations = reservations.filter((r) => r.checkOut >= today).slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/vikendice" className="text-xs font-semibold text-black/40 hover:text-[#ff7f00]">
          ← Sve vikendice
        </Link>
        <h1 className="text-xl font-bold mt-1">{property.name}</h1>
        <p className="text-sm text-black/50 mt-1">{property.location}</p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label={pendingCount === 1 ? "Novi upit" : "Novih upita"} value={pendingCount} />
        <StatCard label="Dana zauzeto ovaj mjesec" value={daysBookedThisMonth} />
        <StatCard label="Zarada ovaj mjesec (neto)" value={earnings.netEur} suffix=" €" />
        <StatCard label="Pregleda stranice (30 dana)" value={pageViews.last30Days} />
      </section>

      <section className="flex flex-wrap gap-2">
        <Link href={`/admin/kalendar?property=${propertyId}`} className="admin-quicklink">
          Otvori puni kalendar
        </Link>
        <Link href={`/admin/rezervacije?property=${propertyId}`} className="admin-quicklink">
          Rezervacije i zarada
        </Link>
        <Link href={`/admin/inquiries?property=${propertyId}`} className="admin-quicklink">
          Svi upiti ove vikendice
        </Link>
      </section>

      <MiniCalendar propertyId={property.id} propertyName={property.name} blocked={blocked} now={now} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">Zadnji upiti</h2>
          <Link href={`/admin/inquiries?property=${propertyId}`} className="text-xs font-semibold text-[#ff7f00]">
            Svi upiti →
          </Link>
        </div>
        {recentInquiries.length === 0 ? (
          <p className="text-sm text-black/60">Još nema upita za ovu vikendicu.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentInquiries.map((i) => (
              <div
                key={i.id}
                className={
                  "border rounded-xl px-4 py-3 bg-white " + (i.read ? "border-black/10" : "border-[#ff7f00]/50")
                }
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-semibold text-sm">{i.name}</div>
                    <div className="text-xs text-black/50 mt-0.5">
                      {i.email} · {new Date(i.createdAt).toLocaleDateString("hr-HR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!i.read && (
                      <form action={markInquiryReadAction.bind(null, i.id)}>
                        <button
                          type="submit"
                          className="text-xs font-semibold text-[#0000c3] border border-[#0000c3]/20 rounded-full px-3 py-1.5 hover:bg-[#0000c3]/5"
                        >
                          Označi pročitano
                        </button>
                      </form>
                    )}
                    {!i.replied && (
                      <form action={markInquiryRepliedAction.bind(null, i.id)}>
                        <button
                          type="submit"
                          className="text-xs font-semibold text-green-700 border border-green-700/20 rounded-full px-3 py-1.5 hover:bg-green-700/5"
                        >
                          Označi odgovoreno
                        </button>
                      </form>
                    )}
                  </div>
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{i.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {upcomingReservations.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40">
              Nadolazeće rezervacije
            </h2>
            <Link href={`/admin/rezervacije?property=${propertyId}`} className="text-xs font-semibold text-[#ff7f00]">
              Sve rezervacije →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingReservations.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border border-black/10 rounded-xl px-4 py-2.5 bg-white"
              >
                <div>
                  <span className="font-semibold text-sm">{r.guestName}</span>
                  <span className="text-xs text-black/50 ml-2">
                    {r.checkIn} → {r.checkOut}
                  </span>
                </div>
                <span
                  className={
                    "text-[11px] font-semibold px-2.5 py-1 rounded-full " +
                    (r.paid ? "bg-green-600/10 text-green-700" : "bg-[#ff7f00]/10 text-[#ff7f00]")
                  }
                >
                  {r.paid ? "Plaćeno" : "Čeka se"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

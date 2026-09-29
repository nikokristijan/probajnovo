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
  getPropertyFunnel,
} from "@/lib/db/queries";
import { markInquiryReadAction, markInquiryRepliedAction } from "@/lib/actions";
import MiniCalendar from "@/components/admin/MiniCalendar";
import { currentYearMonthZagreb, todayDateStringZagreb, dateStringOffsetFromTodayZagreb } from "@/lib/date";
import { StatCard } from "@/components/admin/StatCard";
import { EmptyState } from "@/components/admin/EmptyState";

/**
 * "Put gosta" — pregledi → upiti → rezervacije zadnjih 30 dana, sa širinom
 * trake razmjernom broju (najveći korak = 100% širine) i postotkom pretvorbe
 * ispod svake sljedeće faze. Vidi getPropertyFunnel za napomenu zašto su sva
 * tri broja NUŽNO iz istog razdoblja.
 */
function FunnelBar({ views, inquiries, reservations }: { views: number; inquiries: number; reservations: number }) {
  const max = Math.max(views, 1);
  const stages = [
    { label: "Pregledi stranice", value: views, pct: null as number | null },
    { label: "Upiti", value: inquiries, pct: views > 0 ? Math.round((inquiries / views) * 100) : null },
    {
      label: "Rezervacije",
      value: reservations,
      pct: inquiries > 0 ? Math.round((reservations / inquiries) * 100) : null,
    },
  ];
  return (
    <div className="flex flex-col gap-2.5">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-3">
          <div className="w-32 shrink-0 text-xs" style={{ color: "var(--neu-ink-faint)" }}>{s.label}</div>
          <div
            className="flex-1 h-6 rounded-full overflow-hidden"
            style={{ boxShadow: "inset 2px 2px 5px var(--neu-shadow), inset -2px -2px 5px var(--neu-highlight)" }}
          >
            <div
              className="admin-bar-grow h-full rounded-full flex items-center justify-end px-2"
              style={{
                width: `${Math.max((s.value / max) * 100, s.value > 0 ? 6 : 0)}%`,
                animationDelay: `${i * 0.12}s`,
                background: "var(--neu-accent)",
              }}
            >
              {s.value > 0 && <span className="text-[11px] font-bold text-white tabular-nums">{s.value}</span>}
            </div>
          </div>
          <div className="w-12 shrink-0 text-xs tabular-nums text-right" style={{ color: "var(--neu-ink-faint)" }}>
            {s.pct !== null ? `${s.pct}%` : ""}
          </div>
        </div>
      ))}
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

  const since30 = dateStringOffsetFromTodayZagreb(-30);
  const [allInquiries, blocked, reservations, earnings, pageViews, funnel] = await Promise.all([
    listInquiries(),
    listBlockedDates(propertyId),
    listReservationsForProperty(propertyId),
    getMonthlyEarnings([propertyId], monthPrefix),
    getPageViewCounts("property", propertyId, since30),
    getPropertyFunnel(propertyId, since30),
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
        <Link href="/admin/vikendice" className="text-xs font-semibold" style={{ color: "var(--neu-ink-faint)" }}>
          ← Sve vikendice
        </Link>
        <h1 className="text-xl font-bold mt-1">{property.name}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--neu-ink-faint)" }}>{property.location}</p>
      </div>

      <section className="admin-animate-grid grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--neu-ink-faint)" }}>
          Put gosta — zadnjih 30 dana
        </h2>
        <div className="neu-card px-4 py-4">
          <FunnelBar views={funnel.views} inquiries={funnel.inquiries} reservations={funnel.reservations} />
          <p className="text-xs mt-3" style={{ color: "var(--neu-ink-faint)" }}>
            Postotak je pretvorba u sljedeću fazu (upiti/pregledi, rezervacije/upiti). Brojač pregleda postoji
            tek od nedavno, pa je omjer pouzdan samo za razdoblje otkad je uveden.
          </p>
        </div>
      </section>

      <MiniCalendar propertyId={property.id} propertyName={property.name} blocked={blocked} now={now} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
            Zadnji upiti
          </h2>
          <Link
            href={`/admin/inquiries?property=${propertyId}`}
            className="text-xs font-semibold"
            style={{ color: "var(--neu-accent)" }}
          >
            Svi upiti →
          </Link>
        </div>
        {recentInquiries.length === 0 ? (
          <EmptyState title="Još nema upita za ovu vikendicu" />
        ) : (
          <div className="flex flex-col gap-2">
            {recentInquiries.map((i) => (
              <div key={i.id} className="neu-card px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {!i.read && <span className="admin-unread-dot" aria-hidden />}
                      <span className="font-semibold text-sm">{i.name}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--neu-ink-faint)" }}>
                      {i.email} · {new Date(i.createdAt).toLocaleDateString("hr-HR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!i.read && (
                      <form action={markInquiryReadAction.bind(null, i.id)}>
                        <button type="submit" className="admin-quicklink" style={{ padding: "6px 12px", fontSize: "12px" }}>
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
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--neu-ink-faint)" }}>
              Nadolazeće rezervacije
            </h2>
            <Link
              href={`/admin/rezervacije?property=${propertyId}`}
              className="text-xs font-semibold"
              style={{ color: "var(--neu-accent)" }}
            >
              Sve rezervacije →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {upcomingReservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between neu-card px-4 py-2.5">
                <div>
                  <span className="font-semibold text-sm">{r.guestName}</span>
                  <span className="text-xs ml-2" style={{ color: "var(--neu-ink-faint)" }}>
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

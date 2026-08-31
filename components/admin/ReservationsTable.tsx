"use client";

import { useMemo, useState } from "react";
import { toggleReservationPaidAction, setReservationDepositAction } from "@/lib/actions";
import DeleteReservationButton from "@/components/admin/DeleteReservationButton";
import type { Reservation } from "@/lib/db/schema";

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });
}

/** "Nadolazi" / "U tijeku" / "Završeno" na temelju checkIn/checkOut vs danas
    (Zagreb) — čisto izvedeno, bez dodatnog polja u bazi. */
function stayStatus(r: Reservation, today: string): { label: string; className: string } {
  if (today < r.checkIn) return { label: "Nadolazi", className: "bg-black/5 text-black/60" };
  if (today < r.checkOut) return { label: "U tijeku", className: "bg-[#0000c3]/10 text-[#0000c3]" };
  return { label: "Završeno", className: "bg-black/5 text-black/40" };
}

/**
 * Tablica rezervacija s pretragom po gostu i filterom "samo neplaćeno" —
 * client-side (podaci već stižu s poslužitelja preko app/admin/rezervacije),
 * korisno kad ih ima puno da vlasnik brzo nađe konkretnog gosta. `today`
 * mora doći iz todayDateStringZagreb() (vidi lib/date.ts).
 */
export default function ReservationsTable({
  propertyId,
  reservations,
  today,
}: {
  propertyId: number;
  reservations: Reservation[];
  today: string;
}) {
  // Broj PRIJAŠNJIH rezervacija istog gosta (po imenu, case-insensitive) za
  // ovu vikendicu — "gost je već bio" oznaka, izvedeno iz već učitanih
  // podataka bez dodatnog upita. Računa se na CIJELOM popisu (ne na
  // filtriranom) da broj ostane točan i kad se nešto pretražuje/filtrira.
  const priorVisitCountById = useMemo(() => {
    const sorted = [...reservations].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const seenCountByName = new Map<string, number>();
    const result = new Map<number, number>();
    for (const r of sorted) {
      const key = r.guestName.trim().toLowerCase();
      const priorCount = seenCountByName.get(key) ?? 0;
      result.set(r.id, priorCount);
      seenCountByName.set(key, priorCount + 1);
    }
    return result;
  }, [reservations]);
  const [search, setSearch] = useState("");
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      if (onlyUnpaid && r.paid) return false;
      if (q && !r.guestName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reservations, search, onlyUnpaid]);

  if (reservations.length === 0) {
    return <p className="text-sm text-black/60">Još nema unesenih rezervacija za ovu vikendicu.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pretraži po imenu gosta…"
          className="admin-input max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-xs font-medium text-black/60">
          <input
            type="checkbox"
            checked={onlyUnpaid}
            onChange={(e) => setOnlyUnpaid(e.target.checked)}
            className="w-4 h-4"
          />
          Samo neplaćeno
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/60">Nema rezervacija koje odgovaraju pretrazi.</p>
      ) : (
        <div className="overflow-x-auto border border-black/10 rounded-xl bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/10">
                <th className="px-4 py-2.5 font-semibold">Gost</th>
                <th className="px-4 py-2.5 font-semibold">Dolazak</th>
                <th className="px-4 py-2.5 font-semibold">Odlazak</th>
                <th className="px-4 py-2.5 font-semibold">Boravak</th>
                <th className="px-4 py-2.5 font-semibold">Cijena</th>
                <th className="px-4 py-2.5 font-semibold">Plaćanje</th>
                <th className="px-4 py-2.5 font-semibold">Kontakt / napomena</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const status = stayStatus(r, today);
                const priorVisits = priorVisitCountById.get(r.id) ?? 0;
                return (
                <tr key={r.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {r.guestName}
                    {r.guestCount != null && (
                      <span className="ml-1.5 text-xs font-normal text-black/40">· {r.guestCount} os.</span>
                    )}
                    {priorVisits > 0 && (
                      <div className="text-[11px] font-normal text-[#0000c3] mt-0.5">
                        Već bio/bila {priorVisits}×
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkIn)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkOut)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={"text-[11px] font-semibold px-2.5 py-1 rounded-full " + status.className}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{r.priceEur} €</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <form action={toggleReservationPaidAction.bind(null, propertyId, r.id, r.paid)}>
                      <button
                        type="submit"
                        className={
                          "text-[11px] font-semibold px-2.5 py-1 rounded-full " +
                          (r.paid ? "bg-green-600/10 text-green-700" : "bg-[#ff7f00]/10 text-[#ff7f00]")
                        }
                      >
                        {r.paid ? "Plaćeno" : r.depositEur ? `Kapara ${r.depositEur} €` : "Čeka se"}
                      </button>
                    </form>
                    {!r.paid && (
                      <form
                        action={setReservationDepositAction.bind(null, propertyId, r.id)}
                        className="flex items-center gap-1 mt-1.5"
                      >
                        <input
                          name="depositEur"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={r.depositEur ?? ""}
                          placeholder="kapara €"
                          className="admin-input text-xs px-2 py-1 w-20"
                        />
                        <button type="submit" className="text-[11px] text-black/40 hover:text-black">
                          spremi
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-3 text-black/60 text-xs max-w-[220px]">
                    {[r.phone, r.email].filter(Boolean).join(" · ")}
                    {r.note && <div className="mt-1 whitespace-pre-wrap">{r.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteReservationButton propertyId={propertyId} id={r.id} guestName={r.guestName} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

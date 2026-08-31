"use client";

import { useMemo, useState } from "react";
import { toggleReservationPaidAction } from "@/lib/actions";
import DeleteReservationButton from "@/components/admin/DeleteReservationButton";
import type { Reservation } from "@/lib/db/schema";

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });
}

/**
 * Tablica rezervacija s pretragom po gostu i filterom "samo neplaćeno" —
 * client-side (podaci već stižu s poslužitelja preko app/admin/rezervacije),
 * korisno kad ih ima puno da vlasnik brzo nađe konkretnog gosta.
 */
export default function ReservationsTable({
  propertyId,
  reservations,
}: {
  propertyId: number;
  reservations: Reservation[];
}) {
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
                <th className="px-4 py-2.5 font-semibold">Cijena</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Kontakt / napomena</th>
                <th className="px-4 py-2.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">{r.guestName}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkIn)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkOut)}</td>
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
                        {r.paid ? "Plaćeno" : "Čeka se"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-black/60 text-xs max-w-[220px]">
                    {[r.phone, r.email].filter(Boolean).join(" · ")}
                    {r.note && <div className="mt-1 whitespace-pre-wrap">{r.note}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DeleteReservationButton propertyId={propertyId} id={r.id} guestName={r.guestName} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { toggleReservationPaidAction, setReservationDepositAction, deleteReservationAction } from "@/lib/actions";
import OwnerDeleteButton from "@/components/admin/OwnerDeleteButton";
import type { Reservation } from "@/lib/db/schema";

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });
}

/** Isto kao stayStatus u ReservationsTable.tsx, samo owner-pill-* klase
    (vidi globals.css) umjesto fiksnih bg-black/5 text-black/60 i sličnih —
    te ne rade preko tamnog stakla (vidi opsežan komentar uz .owner-pill-*). */
function stayStatus(r: Reservation, today: string): { label: string; className: string } {
  if (today < r.checkIn) return { label: "Nadolazi", className: "owner-pill-neutral" };
  if (today < r.checkOut) return { label: "U tijeku", className: "owner-pill-info" };
  return { label: "Završeno", className: "owner-pill-neutral" };
}

/**
 * Stakleni klon ReservationsTable.tsx — NAMJERNO odvojena komponenta (vidi
 * OwnerReservationForm za obrazloženje). Ista logika/pretraga/filter.
 */
export default function OwnerReservationsTable({
  propertyId,
  reservations,
  today,
}: {
  propertyId: number;
  reservations: Reservation[];
  today: string;
}) {
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
    return (
      <p className="text-sm" style={{ color: "var(--od-ink-soft)" }}>
        Još nema unesenih rezervacija za ovu vikendicu.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pretraži po imenu gosta…"
          className="owner-input max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
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
        <p className="text-sm" style={{ color: "var(--od-ink-soft)" }}>
          Nema rezervacija koje odgovaraju pretrazi.
        </p>
      ) : (
        <div className="owner-glass owner-glass-grain rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs border-b"
                style={{ color: "var(--od-ink-faint)", borderColor: "var(--od-hairline)" }}
              >
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
                  <tr
                    key={r.id}
                    className="border-b last:border-0 align-top"
                    style={{ borderColor: "var(--od-hairline)" }}
                  >
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      {r.guestName}
                      {r.guestCount != null && (
                        <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--od-ink-faint)" }}>
                          · {r.guestCount} os.
                        </span>
                      )}
                      {priorVisits > 0 && (
                        <div className="text-[11px] font-normal mt-0.5" style={{ color: "var(--od-navy)" }}>
                          Već bio/bila {priorVisits}×
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkIn)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(r.checkOut)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={"owner-pill " + status.className}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{r.priceEur} €</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <form action={toggleReservationPaidAction.bind(null, propertyId, r.id, r.paid)}>
                        <button
                          type="submit"
                          className={"owner-pill " + (r.paid ? "owner-pill-success" : "owner-pill-warning")}
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
                            className="owner-input text-xs px-2 py-1 w-20"
                          />
                          <button
                            type="submit"
                            className="text-[11px] hover:underline"
                            style={{ color: "var(--od-ink-faint)" }}
                          >
                            spremi
                          </button>
                        </form>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[220px]" style={{ color: "var(--od-ink-soft)" }}>
                      {[r.phone, r.email].filter(Boolean).join(" · ")}
                      {r.note && <div className="mt-1 whitespace-pre-wrap">{r.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <OwnerDeleteButton
                        action={deleteReservationAction.bind(null, propertyId, r.id, r.guestName)}
                        confirmMessage={`Sigurno želiš obrisati rezervaciju za "${r.guestName}"? Blokirani dani u kalendaru za ovu rezervaciju će se osloboditi.`}
                      />
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

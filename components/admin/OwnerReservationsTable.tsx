"use client";

import { useMemo, useState } from "react";
import { toggleReservationPaidAction, setReservationDepositAction, deleteReservationAction } from "@/lib/actions";
import OwnerDeleteButton from "@/components/admin/OwnerDeleteButton";
import { OwnerEditReservationButton } from "@/components/admin/OwnerReservationSheet";
import { reservationDeleteDescription, reservationDeleteTitle } from "@/components/admin/reservationConfirmText";
import type { Reservation } from "@/lib/db/schema";

function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("hr-HR", { timeZone: "UTC" });
}

/** "3.–8. 10." ili "30. 9.–4. 10." — kratko za karticu na mobitelu. */
function formatRange(checkIn: string, checkOut: string): string {
  const [, inM, inD] = checkIn.split("-").map(Number);
  const [, outM, outD] = checkOut.split("-").map(Number);
  return inM === outM ? `${inD}.–${outD}. ${outM}.` : `${inD}. ${inM}.–${outD}. ${outM}.`;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
}

function PaymentControls({ propertyId, r }: { propertyId: number; r: Reservation }) {
  return (
    <>
      <form action={toggleReservationPaidAction.bind(null, propertyId, r.id, r.paid)}>
        <button type="submit" className={"owner-pill " + (r.paid ? "owner-pill-success" : "owner-pill-warning")}>
          {r.paid ? "Plaćeno" : r.depositEur ? `Kapara ${r.depositEur} €` : "Čeka se"}
        </button>
      </form>
      {!r.paid && (
        <form action={setReservationDepositAction.bind(null, propertyId, r.id)} className="flex items-center gap-1 mt-1.5">
          <input
            name="depositEur"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={r.depositEur ?? ""}
            placeholder="kapara €"
            aria-label={`Kapara za ${r.guestName}`}
            className="owner-input text-xs px-2 py-1 w-20"
          />
          <button type="submit" className="owner-text-action !text-xs">
            spremi
          </button>
        </form>
      )}
    </>
  );
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
  capacityGuests,
}: {
  propertyId: number;
  reservations: Reservation[];
  today: string;
  capacityGuests?: number;
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
        <>
        {/* Mobitel (plan #37): kartica po gostu umjesto tablice koja se reže. */}
        <ul className="flex flex-col gap-2.5 sm:hidden">
          {filtered.map((r) => {
            const status = stayStatus(r, today);
            const nights = nightsBetween(r.checkIn, r.checkOut);
            return (
              <li key={r.id} className="owner-glass owner-glass-grain rounded-2xl owner-res-card">
                <div className="owner-res-card-row">
                  <span className="font-semibold text-[15px] min-w-0 truncate">{r.guestName}</span>
                  <span className="text-[15px] font-bold tabular-nums shrink-0">{r.priceEur} €</span>
                </div>
                <div className="owner-res-card-row text-sm" style={{ color: "var(--od-ink-soft)" }}>
                  <span className="tabular-nums">
                    {formatRange(r.checkIn, r.checkOut)} · {nights} {nights === 1 ? "noć" : "noći"}
                    {r.guestCount != null ? ` · ${r.guestCount} os.` : ""}
                  </span>
                  <span className={"owner-pill " + status.className}>{status.label}</span>
                </div>
                {(r.phone || r.email || r.note) && (
                  <div className="text-xs flex flex-col gap-0.5" style={{ color: "var(--od-ink-soft)" }}>
                    {r.phone && <a href={`tel:${r.phone.replace(/\s+/g, "")}`}>{r.phone}</a>}
                    {r.email && <a href={`mailto:${r.email}`} className="truncate">{r.email}</a>}
                    {r.note && <p className="whitespace-pre-wrap">{r.note}</p>}
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <PaymentControls propertyId={propertyId} r={r} />
                  </div>
                  <div className="flex items-center gap-2">
                    <OwnerEditReservationButton propertyId={propertyId} reservation={r} capacityGuests={capacityGuests} />
                    <OwnerDeleteButton
                      action={deleteReservationAction.bind(null, propertyId, r.id, r.guestName)}
                      confirmTitle={reservationDeleteTitle(r.guestName, r.checkIn, r.checkOut)}
                      confirmDescription={reservationDeleteDescription(r.checkIn, r.checkOut)}
                      confirmLabel="Obriši rezervaciju"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="owner-glass owner-glass-grain rounded-2xl overflow-x-auto hidden sm:block">
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
                      <PaymentControls propertyId={propertyId} r={r} />
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[220px]" style={{ color: "var(--od-ink-soft)" }}>
                      {[r.phone, r.email].filter(Boolean).join(" · ")}
                      {r.note && <div className="mt-1 whitespace-pre-wrap">{r.note}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <OwnerEditReservationButton propertyId={propertyId} reservation={r} capacityGuests={capacityGuests} />
                        <OwnerDeleteButton
                          action={deleteReservationAction.bind(null, propertyId, r.id, r.guestName)}
                          confirmTitle={reservationDeleteTitle(r.guestName, r.checkIn, r.checkOut)}
                          confirmDescription={reservationDeleteDescription(r.checkIn, r.checkOut)}
                          confirmLabel="Obriši rezervaciju"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}

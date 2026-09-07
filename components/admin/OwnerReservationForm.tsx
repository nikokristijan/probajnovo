"use client";

import { useActionState } from "react";
import { createReservationAction, type ActionState } from "@/lib/actions";

/**
 * Stakleni (liquid glass) klon ReservationForm.tsx — NAMJERNO odvojena
 * komponenta (ista logika/akcija, samo owner-glass/owner-input/owner-btn
 * klase umjesto admin-input/bijele kartice), jer ReservationForm dijeli
 * /admin/rezervacije s punim adminom, gdje mora ostati nepromijenjen (isti
 * obrazac kao OwnerMiniCalendar vs MiniCalendar).
 */
export default function OwnerReservationForm({
  propertyId,
  redirectTo,
  capacityGuests,
}: {
  propertyId: number;
  redirectTo: string;
  capacityGuests?: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createReservationAction.bind(null, propertyId, redirectTo),
    undefined
  );

  return (
    <form action={action} className="owner-glass owner-glass-grain rounded-2xl p-5 flex flex-col gap-3">
      <span className="text-sm font-semibold">Nova rezervacija</span>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Ime gosta
          <input name="guestName" required className="owner-input" placeholder="npr. Ivan Ivić" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Cijena (€)
          <input name="priceEur" type="number" min={0} step={1} required className="owner-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Telefon gosta (opcionalno)
          <input name="phone" type="tel" className="owner-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Email gosta (opcionalno)
          <input name="email" type="email" className="owner-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Dolazak
          <input name="checkIn" type="date" required className="owner-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Odlazak
          <input name="checkOut" type="date" required className="owner-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Broj gostiju (opcionalno){capacityGuests != null ? ` — kapacitet ${capacityGuests}` : ""}
          <input name="guestCount" type="number" min={1} step={1} className="owner-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Kapara (€, opcionalno)
          <input name="depositEur" type="number" min={0} step={1} className="owner-input" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
        Napomena / bilješka (opcionalno)
        <textarea name="note" rows={2} className="owner-input" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="paid" type="checkbox" className="w-4 h-4" />
        Već plaćeno
      </label>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className="owner-btn-primary self-start">
        {pending ? "Spremanje…" : "Dodaj rezervaciju"}
      </button>
    </form>
  );
}

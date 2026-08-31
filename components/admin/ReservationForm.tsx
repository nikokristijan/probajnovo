"use client";

import { useActionState } from "react";
import { createReservationAction, type ActionState } from "@/lib/actions";

/**
 * Forma za unos nove rezervacije u "Rezervacije" — puna knjiga rezervacija
 * koja zamjenjuje vlasnikovu bilježnicu (vidi app/admin/rezervacije). Kreira
 * rezervaciju i automatski blokira noćenja u kalendaru (vidi
 * lib/db/queries.ts createReservation).
 */
export default function ReservationForm({
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
    <form action={action} className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-3">
      <span className="text-sm font-semibold">Nova rezervacija</span>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Ime gosta
          <input name="guestName" required className="admin-input" placeholder="npr. Ivan Ivić" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Cijena (€)
          <input name="priceEur" type="number" min={0} step={1} required className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Telefon gosta (opcionalno)
          <input name="phone" type="tel" className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Email gosta (opcionalno)
          <input name="email" type="email" className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Dolazak
          <input name="checkIn" type="date" required className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Odlazak
          <input name="checkOut" type="date" required className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Broj gostiju (opcionalno){capacityGuests != null ? ` — kapacitet ${capacityGuests}` : ""}
          <input name="guestCount" type="number" min={1} step={1} className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Kapara (€, opcionalno)
          <input name="depositEur" type="number" min={0} step={1} className="admin-input" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
        Napomena / bilješka (opcionalno)
        <textarea name="note" rows={2} className="admin-input" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="paid" type="checkbox" className="w-4 h-4" />
        Već plaćeno
      </label>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Spremanje…" : "Dodaj rezervaciju"}
      </button>
    </form>
  );
}

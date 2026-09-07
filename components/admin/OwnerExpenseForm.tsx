"use client";

import { useActionState } from "react";
import { createExpenseAction, type ActionState } from "@/lib/actions";

/**
 * Stakleni klon ExpenseForm.tsx — NAMJERNO odvojena komponenta (vidi
 * OwnerReservationForm za obrazloženje).
 */
export default function OwnerExpenseForm({
  propertyId,
  redirectTo,
}: {
  propertyId: number;
  redirectTo: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createExpenseAction.bind(null, propertyId, redirectTo),
    undefined
  );

  return (
    <form action={action} className="owner-glass owner-glass-grain rounded-2xl p-5 flex flex-col gap-3">
      <span className="text-sm font-semibold">Novi trošak</span>
      <div className="grid sm:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-1" style={{ color: "var(--od-ink-soft)" }}>
          Opis
          <input name="description" required className="owner-input" placeholder="npr. Čišćenje" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Kategorija
          <select name="category" className="owner-input" defaultValue="ostalo">
            <option value="čišćenje">Čišćenje</option>
            <option value="održavanje">Održavanje</option>
            <option value="režije">Režije</option>
            <option value="ostalo">Ostalo</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Iznos (€)
          <input name="amountEur" type="number" min={0} step={1} required className="owner-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: "var(--od-ink-soft)" }}>
          Datum
          <input name="date" type="date" required className="owner-input" />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className="owner-quicklink self-start disabled:opacity-50">
        {pending ? "Spremanje…" : "Dodaj trošak"}
      </button>
    </form>
  );
}

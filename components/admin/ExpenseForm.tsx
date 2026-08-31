"use client";

import { useActionState } from "react";
import { createExpenseAction, type ActionState } from "@/lib/actions";

/**
 * Forma za unos troška (čišćenje, održavanje i sl.) — opcionalno, vidi
 * app/admin/rezervacije i lib/db/queries.ts getMonthlyEarnings (neto zarada).
 */
export default function ExpenseForm({
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
    <form action={action} className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-3">
      <span className="text-sm font-semibold">Novi trošak</span>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60 sm:col-span-1">
          Opis
          <input name="description" required className="admin-input" placeholder="npr. Čišćenje" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Iznos (€)
          <input name="amountEur" type="number" min={0} step={1} required className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Datum
          <input name="date" type="date" required className="admin-input" />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full border border-black/15 text-sm font-semibold px-4 py-2 hover:border-black/40 disabled:opacity-50"
      >
        {pending ? "Spremanje…" : "Dodaj trošak"}
      </button>
    </form>
  );
}

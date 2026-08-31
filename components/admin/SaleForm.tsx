"use client";

import { useActionState } from "react";
import { createSaleAction, type ActionState } from "@/lib/actions";

const CATEGORY_LABELS: Record<string, string> = {
  stranica: "Izrada stranice",
  proizvod: "Proizvod",
  konzultacija: "Konzultacija",
  ostalo: "Ostalo",
};

/** Forma za ručni unos prodaje — vidi app/admin/prodaja i lib/db/schema.ts sales. */
export default function SaleForm({ redirectTo }: { redirectTo: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createSaleAction.bind(null, redirectTo),
    undefined
  );

  return (
    <form action={action} className="border border-black/10 rounded-xl p-5 bg-white flex flex-col gap-3">
      <span className="text-sm font-semibold">Nova prodaja</span>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Kategorija
          <select name="category" required className="admin-input" defaultValue="stranica">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Što je prodano
          <input name="item" required className="admin-input" placeholder="npr. Izrada stranice — Sokak bez imena" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Kupac (opcionalno)
          <input name="buyerName" className="admin-input" placeholder="Ime / firma" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Cijena (€)
          <input name="priceEur" type="number" min={0} step={1} required className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60">
          Datum
          <input name="date" type="date" required className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-black/60 sm:col-span-2">
          Napomena (opcionalno)
          <input name="note" className="admin-input" />
        </label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
      >
        {pending ? "Spremanje…" : "Dodaj prodaju"}
      </button>
    </form>
  );
}

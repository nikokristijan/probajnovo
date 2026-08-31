"use client";

import { deleteSaleAction } from "@/lib/actions";

export default function DeleteSaleButton({ id, item }: { id: number; item: string }) {
  return (
    <form
      action={deleteSaleAction.bind(null, id)}
      onSubmit={(e) => {
        if (!confirm(`Sigurno želiš obrisati prodaju "${item}"?`)) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
      >
        Obriši
      </button>
    </form>
  );
}

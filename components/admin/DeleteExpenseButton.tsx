"use client";

import { deleteExpenseAction } from "@/lib/actions";

export default function DeleteExpenseButton({
  propertyId,
  id,
  description,
}: {
  propertyId: number;
  id: number;
  description: string;
}) {
  return (
    <form
      action={deleteExpenseAction.bind(null, propertyId, id)}
      onSubmit={(e) => {
        if (!confirm(`Sigurno želiš obrisati trošak "${description}"?`)) {
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

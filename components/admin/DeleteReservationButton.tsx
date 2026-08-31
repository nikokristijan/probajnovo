"use client";

import { deleteReservationAction } from "@/lib/actions";

export default function DeleteReservationButton({
  propertyId,
  id,
  guestName,
}: {
  propertyId: number;
  id: number;
  guestName: string;
}) {
  return (
    <form
      action={deleteReservationAction.bind(null, propertyId, id)}
      onSubmit={(e) => {
        if (!confirm(`Sigurno želiš obrisati rezervaciju za "${guestName}"? Blokirani dani u kalendaru za ovu rezervaciju će se osloboditi.`)) {
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

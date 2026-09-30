"use client";

import { deleteExpenseAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

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
    <ConfirmSubmit
      action={deleteExpenseAction.bind(null, propertyId, id, description)}
      title={`Obrisati trošak ${description}?`}
      description="Iznos se miče iz neto zarade za taj mjesec."
      confirmLabel="Obriši trošak"
      buttonLabel="Obriši"
      buttonClassName="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
    />
  );
}

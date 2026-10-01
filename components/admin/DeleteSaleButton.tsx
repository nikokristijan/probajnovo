"use client";

import { deleteSaleAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteSaleButton({ id, item }: { id: number; item: string }) {
  return (
    <ConfirmSubmit
      action={deleteSaleAction.bind(null, id)}
      title={`Obrisati prodaju ${item}?`}
      description="Iznos se miče iz financija."
      confirmLabel="Obriši prodaju"
      buttonLabel="Obriši"
      buttonClassName="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
    />
  );
}

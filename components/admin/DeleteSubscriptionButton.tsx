"use client";

import { deleteSubscriptionAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteSubscriptionButton({ id, name }: { id: number; name: string }) {
  return (
    <ConfirmSubmit
      action={deleteSubscriptionAction.bind(null, id)}
      title={`Obrisati pretplatu za ${name}?`}
      description="Pretplata nestaje iz MRR-a i povijesti. Ako je klijent samo otkazao, radije promijeni status u otkazano."
      confirmLabel="Obriši pretplatu"
      buttonLabel="Obriši"
      buttonClassName="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
    />
  );
}

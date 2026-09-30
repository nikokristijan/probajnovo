"use client";

import { deleteAdminAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteAdminButton({ id, email }: { id: number; email: string }) {
  return (
    <ConfirmSubmit
      action={deleteAdminAction.bind(null, id)}
      title={`Maknuti pristup za ${email}?`}
      description="Ta osoba se više neće moći prijaviti u admin. Račun se može ponovno stvoriti."
      confirmLabel="Makni pristup"
      buttonLabel="Ukloni"
      buttonClassName="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
    />
  );
}

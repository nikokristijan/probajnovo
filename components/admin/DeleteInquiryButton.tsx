"use client";

import { deleteInquiryAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteInquiryButton({ id, name }: { id: number; name: string }) {
  return (
    <ConfirmSubmit
      action={deleteInquiryAction.bind(null, id)}
      title={`Trajno obrisati upit od ${name}?`}
      description="Poruka se briše i ne može se vratiti."
      confirmLabel="Obriši upit"
      buttonLabel="Obriši"
      buttonClassName="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
    />
  );
}

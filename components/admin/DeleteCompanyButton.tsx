"use client";

import { deleteCompanyAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export default function DeleteCompanyButton({ id, name }: { id: number; name: string }) {
  return (
    <ConfirmSubmit
      action={deleteCompanyAction.bind(null, id)}
      title={`Trajno obrisati firmu ${name}?`}
      description="Stranica firme prestaje raditi, a pristupi vlasnika i upiti se brišu. Pretplata ostaje u financijama kao otkazana."
      confirmLabel="Obriši firmu"
      buttonLabel="Obriši firmu"
      buttonClassName="text-sm font-semibold text-red-600 border border-red-200 rounded-full px-4 py-2 hover:bg-red-50"
    />
  );
}

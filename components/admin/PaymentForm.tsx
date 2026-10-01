"use client";

import { useActionState } from "react";
import { recordPaymentAction, type SimpleState } from "@/lib/actions-superadmin";

/** Evidencija uplate pretplate (plan #17) — spremanje produljuje pretplatu. */
export default function PaymentForm({
  subscriptionId,
  monthlyPriceEur,
  today,
}: {
  subscriptionId: number;
  monthlyPriceEur: number;
  today: string;
}) {
  const [state, action, pending] = useActionState<SimpleState, FormData>(
    recordPaymentAction.bind(null, subscriptionId),
    undefined
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Iznos (€)
          <input name="amountEur" type="number" min={1} inputMode="numeric" required defaultValue={monthlyPriceEur} className="admin-input font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Datum
          <input name="paidOn" type="date" lang="hr" required defaultValue={today} className="admin-input font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Pokriva mjeseci
          <input name="months" type="number" min={1} max={24} inputMode="numeric" required defaultValue={1} className="admin-input font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Način
          <select name="method" className="admin-input font-normal" defaultValue="">
            <option value="">—</option>
            <option value="Uplata na račun">Uplata na račun</option>
            <option value="Gotovina">Gotovina</option>
            <option value="Kartica">Kartica</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Napomena
        <input name="note" className="admin-input font-normal" placeholder="npr. broj računa ili poziv na broj" />
      </label>
      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && !pending && (
        <p className="text-sm text-[#0a6b37] font-medium" role="status">
          Uplata je zapisana i pretplata produljena.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Spremam…" : "Zapiši uplatu"}
      </button>
    </form>
  );
}

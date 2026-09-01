"use client";

import { useActionState } from "react";
import { runPushMigrationAction, type RunPushMigrationState } from "@/lib/actions";

/**
 * Jednokratni "popravi bazu" gumb — vidi lib/actions.ts runPushMigrationAction.
 * Prikazuje se u app/admin/settings SAMO kad je hasPushSubscription upit
 * pukao (znak da push_subscriptions tablica vjerojatno ne postoji), pa se
 * ne zatrpava normalne postavke kad je sve u redu.
 */
export default function RunPushMigrationButton() {
  const [state, action, pending] = useActionState<RunPushMigrationState, FormData>(
    runPushMigrationAction,
    undefined
  );

  if (state?.success) {
    return (
      <p className="text-sm text-green-700">
        Gotovo — tablica je spremna. Osvježi stranicu i probaj ponovno uključiti obavijesti.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <p className="text-sm text-red-600 max-w-sm">
        Obavijesti u bazi nisu postavljene (nedostaje tablica). Klikni da to popraviš.
      </p>
      {state?.error && <p className="text-xs text-red-600">Greška: {state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Popravljam…" : "Popravi bazu"}
      </button>
    </form>
  );
}

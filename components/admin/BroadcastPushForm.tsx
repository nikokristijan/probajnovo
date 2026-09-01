"use client";

import { useActionState } from "react";
import { sendBroadcastPushAction, type BroadcastPushState } from "@/lib/actions";

/**
 * "Pošalji obavijest svim uređajima" na /admin/settings — ručna broadcast
 * push obavijest svakom pretplaćenom uređaju svih admina (uključujući
 * vlasnike koji su uključili obavijesti), ne samo onima s pristupom
 * određenoj vikendici/firmi kao kod automatskih okidača (novi upit/
 * rezervacija/podsjetnik, vidi lib/push.ts). Vidljivo SAMO punim adminima
 * (role="admin") — vidi requireAdmin u sendBroadcastPushAction i uvjet u
 * app/admin/settings/page.tsx koji ovu komponentu uopće ne renderira
 * vlasnicima.
 */
export default function BroadcastPushForm() {
  const [state, action, pending] = useActionState<BroadcastPushState, FormData>(
    sendBroadcastPushAction,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-3 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="broadcastTitle" className="text-sm font-medium">
          Naslov
        </label>
        <input
          id="broadcastTitle"
          name="title"
          type="text"
          required
          maxLength={80}
          placeholder="npr. Obavijest"
          className="admin-input"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="broadcastBody" className="text-sm font-medium">
          Poruka
        </label>
        <textarea
          id="broadcastBody"
          name="body"
          required
          maxLength={500}
          rows={3}
          placeholder="Tekst obavijesti…"
          className="admin-input resize-none"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-green-700">
          Poslano na {state.sent} uređaj{state.sent === 1 ? "" : "a"}
          {!!state.failed && ` (${state.failed} nije uspjelo — vjerojatno stari/neaktivni uređaji)`}.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
      >
        {pending ? "Šaljem…" : "Pošalji svim uređajima"}
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { verifyTwoFactorLoginAction, type ActionState } from "@/lib/actions";

export default function TwoFactorLoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    verifyTwoFactorLoginAction,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium">
          Kod iz aplikacije
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
          className="border border-black/15 rounded-lg px-3 py-2 text-sm tracking-[0.3em] text-center outline-none focus:border-[#0000c3]"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
      >
        {pending ? "Provjera…" : "Potvrdi"}
      </button>
    </form>
  );
}

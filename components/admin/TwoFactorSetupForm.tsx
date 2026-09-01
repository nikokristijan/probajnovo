"use client";

import { useActionState } from "react";
import Image from "next/image";
import {
  startTwoFactorSetupAction,
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  type ActionState,
  type TwoFactorSetupState,
} from "@/lib/actions";

/**
 * Samo-postavljanje 2FA na /admin/settings — dva koraka (QR kod pa potvrdni
 * kod) prije nego se stvarno uključi, isto kao lib/actions.ts
 * startTwoFactorSetupAction/confirmTwoFactorSetupAction objašnjavaju. `enabled`
 * je izvedeno iz rezultata akcija umjesto ručnog useState/useEffect — ako je
 * disable akcija uspjela, isključeno je; inače ako je confirm akcija uspjela,
 * uključeno je; inače početno stanje sa servera (initialEnabled).
 */
export default function TwoFactorSetupForm({ initialEnabled }: { initialEnabled: boolean }) {
  const [setupState, startAction, startPending] = useActionState<TwoFactorSetupState, FormData>(
    startTwoFactorSetupAction,
    undefined
  );
  const [confirmState, confirmAction, confirmPending] = useActionState<ActionState, FormData>(
    confirmTwoFactorSetupAction,
    undefined
  );
  const [disableState, disableAction, disablePending] = useActionState<ActionState, FormData>(
    disableTwoFactorAction,
    undefined
  );

  const enabled = disableState?.success ? false : confirmState?.success ? true : initialEnabled;

  if (enabled) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-green-700">2FA je uključena za tvoj račun.</p>
        <form action={disableAction} className="flex flex-col gap-3 max-w-sm">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="currentPassword2fa" className="text-sm font-medium">
              Trenutna lozinka (za isključivanje)
            </label>
            <input
              id="currentPassword2fa"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="admin-input"
            />
          </div>
          {disableState?.error && <p className="text-sm text-red-600">{disableState.error}</p>}
          <button
            type="submit"
            disabled={disablePending}
            className="self-start rounded-full border border-red-600 text-red-600 text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
          >
            {disablePending ? "Isključivanje…" : "Isključi 2FA"}
          </button>
        </form>
      </div>
    );
  }

  if (!setupState?.qrDataUrl) {
    return (
      <form action={startAction} className="flex flex-col gap-3">
        <p className="text-sm text-black/60 max-w-sm">
          Dodaj dodatni sloj sigurnosti — nakon lozinke, prijava će tražiti i kod iz aplikacije za
          autentifikaciju (npr. Google Authenticator).
        </p>
        {setupState?.error && <p className="text-sm text-red-600">{setupState.error}</p>}
        <button
          type="submit"
          disabled={startPending}
          className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
        >
          {startPending ? "Pripremam…" : "Uključi 2FA"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <p className="text-sm text-black/60">
        Skeniraj ovaj QR kod u aplikaciji za autentifikaciju, pa unesi kod koji ti generira da potvrdiš.
      </p>
      <Image
        src={setupState.qrDataUrl}
        alt="QR kod za 2FA"
        width={200}
        height={200}
        unoptimized
        className="border border-black/10 rounded-lg"
      />
      {setupState.secretDisplay && (
        <p className="text-xs text-black/40 break-all">
          Ne radi skeniranje? Unesi ručno: <span className="font-mono">{setupState.secretDisplay}</span>
        </p>
      )}
      <form action={confirmAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmCode" className="text-sm font-medium">
            Kod iz aplikacije
          </label>
          <input
            id="confirmCode"
            name="code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            className="admin-input tracking-[0.3em] text-center"
          />
        </div>
        {confirmState?.error && <p className="text-sm text-red-600">{confirmState.error}</p>}
        <button
          type="submit"
          disabled={confirmPending}
          className="self-start rounded-full bg-black text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-50"
        >
          {confirmPending ? "Provjera…" : "Potvrdi i uključi"}
        </button>
      </form>
    </div>
  );
}

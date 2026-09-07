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
 * Stakleni klon TwoFactorSetupForm.tsx — NAMJERNO odvojena komponenta (vidi
 * OwnerReservationForm za obrazloženje). Ista logika u tri koraka.
 */
export default function OwnerTwoFactorSetupForm({ initialEnabled }: { initialEnabled: boolean }) {
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
        <p className="text-sm" style={{ color: "#34d399" }}>
          2FA je uključena za tvoj račun.
        </p>
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
              className="owner-input"
            />
          </div>
          {disableState?.error && <p className="text-sm text-red-400">{disableState.error}</p>}
          <button type="submit" disabled={disablePending} className="owner-btn-danger self-start">
            {disablePending ? "Isključivanje…" : "Isključi 2FA"}
          </button>
        </form>
      </div>
    );
  }

  if (!setupState?.qrDataUrl) {
    return (
      <form action={startAction} className="flex flex-col gap-3">
        <p className="text-sm max-w-sm" style={{ color: "var(--od-ink-soft)" }}>
          Dodaj dodatni sloj sigurnosti — nakon lozinke, prijava će tražiti i kod iz aplikacije za
          autentifikaciju (npr. Google Authenticator).
        </p>
        {setupState?.error && <p className="text-sm text-red-400">{setupState.error}</p>}
        <button type="submit" disabled={startPending} className="owner-btn-primary self-start">
          {startPending ? "Pripremam…" : "Uključi 2FA"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <p className="text-sm" style={{ color: "var(--od-ink-soft)" }}>
        Skeniraj ovaj QR kod u aplikaciji za autentifikaciju, pa unesi kod koji ti generira da potvrdiš.
      </p>
      <Image
        src={setupState.qrDataUrl}
        alt="QR kod za 2FA"
        width={200}
        height={200}
        unoptimized
        className="rounded-lg"
        style={{ border: "1px solid var(--od-hairline)", background: "#fff" }}
      />
      {setupState.secretDisplay && (
        <p className="text-xs break-all" style={{ color: "var(--od-ink-faint)" }}>
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
            className="owner-input tracking-[0.3em] text-center"
          />
        </div>
        {confirmState?.error && <p className="text-sm text-red-400">{confirmState.error}</p>}
        <button type="submit" disabled={confirmPending} className="owner-btn-primary self-start">
          {confirmPending ? "Provjera…" : "Potvrdi i uključi"}
        </button>
      </form>
    </div>
  );
}

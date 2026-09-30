"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { createReservationAction, updateReservationAction, type ActionState } from "@/lib/actions";
import type { Reservation } from "@/lib/db/schema";

/**
 * Vlasnički unos i uređivanje rezervacije u donjem listu (plan #36 i #38).
 * Na mobitelu list izlazi odozdo (gdje je palac), na većem ekranu je
 * centriran prozor. Ista polja za "Nova rezervacija" i "Uredi".
 */

function Sheet({
  dialogRef,
  title,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  children: ReactNode;
}) {
  return (
    <dialog
      ref={dialogRef}
      className="owner-sheet"
      aria-label={title}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="owner-sheet-card">
        <div className="owner-sheet-head">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            type="button"
            className="owner-sheet-close"
            aria-label="Zatvori"
            onClick={() => dialogRef.current?.close()}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label
      className={"flex flex-col gap-1 text-xs font-medium" + (wide ? " sm:col-span-2" : "")}
      style={{ color: "var(--od-ink-soft)" }}
    >
      {label}
      {children}
    </label>
  );
}

function ReservationFields({
  r,
  capacityGuests,
  withPaid,
}: {
  r?: Reservation;
  capacityGuests?: number;
  withPaid?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Ime gosta">
        <input name="guestName" required defaultValue={r?.guestName} className="owner-input" placeholder="npr. Ivan Ivić" />
      </Field>
      <Field label="Cijena (€)">
        <input name="priceEur" type="number" inputMode="numeric" min={0} step={1} required defaultValue={r?.priceEur} className="owner-input" />
      </Field>
      <Field label="Dolazak">
        <input name="checkIn" type="date" lang="hr" required defaultValue={r?.checkIn} className="owner-input" />
      </Field>
      <Field label="Odlazak">
        <input name="checkOut" type="date" lang="hr" required defaultValue={r?.checkOut} className="owner-input" />
      </Field>
      <Field label={`Broj gostiju${capacityGuests != null ? ` (kapacitet ${capacityGuests})` : ""}`}>
        <input name="guestCount" type="number" inputMode="numeric" min={1} step={1} defaultValue={r?.guestCount ?? ""} className="owner-input" />
      </Field>
      <Field label="Kapara (€)">
        <input name="depositEur" type="number" inputMode="numeric" min={0} step={1} defaultValue={r?.depositEur ?? ""} className="owner-input" />
      </Field>
      <Field label="Telefon gosta">
        <input name="phone" type="tel" defaultValue={r?.phone ?? ""} className="owner-input" />
      </Field>
      <Field label="Email gosta">
        {/* type="text": stari unosi znaju imati razmak u adresi, a
            type="email" bi tada tiho blokirao spremanje. Provjera je na serveru. */}
        <input name="email" type="text" inputMode="email" autoComplete="off" defaultValue={r?.email ?? ""} className="owner-input" />
      </Field>
      <Field label="Napomena" wide>
        <textarea name="note" rows={2} defaultValue={r?.note ?? ""} className="owner-input" />
      </Field>
      {withPaid && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input name="paid" type="checkbox" className="w-4 h-4" />
          Već plaćeno
        </label>
      )}
    </div>
  );
}

/** Zatvori list kad akcija završi bez greške. */
function useCloseOnDone(pending: boolean, state: ActionState, close: () => void) {
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error && !state?.warning) close();
    wasPending.current = pending;
  }, [pending, state, close]);
}

export function OwnerNewReservationButton({
  propertyId,
  redirectTo,
  capacityGuests,
}: {
  propertyId: number;
  redirectTo: string;
  capacityGuests?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createReservationAction.bind(null, propertyId, redirectTo),
    undefined
  );
  useCloseOnDone(pending, state, () => ref.current?.close());

  return (
    <>
      <button type="button" className="owner-btn-primary owner-btn-with-icon" onClick={() => ref.current?.showModal()}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Nova rezervacija
      </button>
      <Sheet dialogRef={ref} title="Nova rezervacija">
        <form action={action} className="flex flex-col gap-4">
          <ReservationFields capacityGuests={capacityGuests} withPaid />
          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          <p className="text-xs" style={{ color: "var(--od-ink-faint)" }}>
            Noćenja se sama blokiraju u kalendaru. Ako gost ima email, dobit će potvrdu.
          </p>
          <button type="submit" disabled={pending} className="owner-btn-primary self-stretch sm:self-start">
            {pending ? "Spremanje…" : "Dodaj rezervaciju"}
          </button>
        </form>
      </Sheet>
    </>
  );
}

export function OwnerEditReservationButton({
  propertyId,
  reservation,
  capacityGuests,
  className = "owner-quicklink",
}: {
  propertyId: number;
  reservation: Reservation;
  capacityGuests?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateReservationAction.bind(null, propertyId, reservation.id),
    undefined
  );
  useCloseOnDone(pending, state, () => ref.current?.close());

  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        Uredi
      </button>
      <Sheet dialogRef={ref} title={`Uredi rezervaciju — ${reservation.guestName}`}>
        <form action={action} className="flex flex-col gap-4">
          <ReservationFields r={reservation} capacityGuests={capacityGuests} />
          {state?.error && <p className="text-sm text-red-500">{state.error}</p>}
          {state?.warning && (
            <p className="text-sm owner-pill owner-pill-warning !normal-case !inline-block px-3 py-2">{state.warning}</p>
          )}
          <button type="submit" disabled={pending} className="owner-btn-primary self-stretch sm:self-start">
            {pending ? "Spremanje…" : "Spremi promjene"}
          </button>
        </form>
      </Sheet>
    </>
  );
}

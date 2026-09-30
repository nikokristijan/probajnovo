"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Vlastita potvrda prije brisanja (plan #58) umjesto sivog browserovog
 * confirm() prozora. Gumb otvara <dialog> s jasnim naslovom ("Obrisati
 * rezervaciju Ana Babić, 3.–8. 10.?"), posljedicom i dva gumba — glavni
 * imenuje radnju ("Obriši rezervaciju"), sporedni je "Zadrži". Dijalog je
 * unutar forme pa glavni gumb samo pošalje tu formu (server action).
 *
 * Boje dolaze iz tokena predaka (--od-* kod vlasnika, --na-* na Portalu),
 * s bijelom/crnom zadanom vrijednošću za superadmin — vidi .confirm-dialog.
 */
export default function ConfirmSubmit({
  action,
  title,
  description,
  confirmLabel = "Obriši",
  cancelLabel = "Zadrži",
  buttonLabel,
  buttonClassName,
  buttonAriaLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  buttonLabel: ReactNode;
  buttonClassName?: string;
  buttonAriaLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  return (
    <form action={action}>
      <button
        type="button"
        className={buttonClassName}
        aria-label={buttonAriaLabel}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(e) => {
          // Klik na zatamnjenu pozadinu (izvan kartice) zatvara dijalog.
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="confirm-dialog-card">
          <h2 id={titleId} className="confirm-dialog-title">
            {title}
          </h2>
          {description && (
            <p id={descId} className="confirm-dialog-desc">
              {description}
            </p>
          )}
          <div className="confirm-dialog-actions">
            <button type="button" className="confirm-dialog-cancel" autoFocus onClick={() => dialogRef.current?.close()}>
              {cancelLabel}
            </button>
            <ConfirmButton label={confirmLabel} onDone={() => dialogRef.current?.close()} />
          </div>
        </div>
      </dialog>
    </form>
  );
}

function ConfirmButton({ label, onDone }: { label: string; onDone: () => void }) {
  const { pending } = useFormStatus();
  // Dijalog ostaje otvoren dok akcija traje ("Brišem…"), pa se zatvori.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);
  return (
    <button type="submit" className="confirm-dialog-danger" disabled={pending}>
      {pending ? "Brišem…" : label}
    </button>
  );
}

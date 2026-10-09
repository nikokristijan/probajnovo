"use client";

import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * Potvrda opasne radnje nad klijentom (npr. gašenje paketa) vlastitim dijalogom umjesto
 * browserovog confirm(). Isti izgled kao ConfirmSubmit (.confirm-dialog), ali s tekstom
 * koji odgovara radnji ("Gasim…", ne "Brišem…") i skrivenim poljem orgId u formi.
 */
export default function RecenzijeConfirmButton({
  action,
  orgId,
  title,
  description,
  buttonLabel,
  confirmLabel,
  pendingLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  orgId: string;
  title: string;
  description: string;
  buttonLabel: string;
  confirmLabel: string;
  pendingLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="text-xs font-semibold px-4 py-2 rounded-full border border-[#d70015]/30 text-[#b80012] hover:border-[#d70015]/60"
      >
        {buttonLabel}
      </button>
      <dialog
        ref={dialogRef}
        className="confirm-dialog"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="confirm-dialog-card">
          <h2 id={titleId} className="confirm-dialog-title">
            {title}
          </h2>
          <p id={descId} className="confirm-dialog-desc">
            {description}
          </p>
          <div className="confirm-dialog-actions">
            <button type="button" className="confirm-dialog-cancel" autoFocus onClick={() => dialogRef.current?.close()}>
              Odustani
            </button>
            <ConfirmButton label={confirmLabel} pendingLabel={pendingLabel} onDone={() => dialogRef.current?.close()} />
          </div>
        </div>
      </dialog>
    </form>
  );
}

function ConfirmButton({ label, pendingLabel, onDone }: { label: string; pendingLabel: string; onDone: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) onDone();
    wasPending.current = pending;
  }, [pending, onDone]);
  return (
    <button type="submit" className="confirm-dialog-danger" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

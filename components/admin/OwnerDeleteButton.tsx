"use client";

/**
 * Zajednički vlasnički "Obriši" gumb (owner-btn-danger, vidi globals.css) —
 * jedna komponenta umjesto zasebnog forka za svaki entitet (rezervacija,
 * trošak...), jer su DeleteReservationButton/DeleteExpenseButton inače
 * identični osim akcije i potvrdne poruke. Puni admin i dalje koristi
 * originalne DeleteReservationButton/DeleteExpenseButton nepromijenjeno.
 */
export default function OwnerDeleteButton({
  action,
  confirmMessage,
  label = "Obriši",
}: {
  action: (formData: FormData) => void | Promise<void>;
  confirmMessage: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="owner-btn-danger">
        {label}
      </button>
    </form>
  );
}

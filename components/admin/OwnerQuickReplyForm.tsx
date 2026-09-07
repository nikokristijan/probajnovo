"use client";

import { useActionState, useState } from "react";
import { sendInquiryReplyAction, type ActionState } from "@/lib/actions";

const TEMPLATES = [
  {
    label: "Termin slobodan",
    text: "Hvala na upitu! Traženi termin je slobodan — javi mi broj gostiju i mogu ti poslati ponudu.",
  },
  {
    label: "Termin zauzet",
    text: "Hvala na upitu! Nažalost, traženi termin je već zauzet — javi ako te zanima neki drugi termin.",
  },
  {
    label: "Šaljem ponudu",
    text: "Hvala na upitu! Uskoro ti šaljem detaljnu ponudu s cijenom i dostupnim terminima.",
  },
];

/**
 * Stakleni klon QuickReplyForm.tsx — NAMJERNO odvojena komponenta (vidi
 * OwnerReservationForm za obrazloženje). Ista logika/predlošci.
 */
export default function OwnerQuickReplyForm({ inquiryId }: { inquiryId: number }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    sendInquiryReplyAction.bind(null, inquiryId),
    undefined
  );

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="owner-quicklink">
        Odgovori
      </button>
    );
  }

  if (state?.success) {
    return (
      <p className="text-xs font-semibold mt-2" style={{ color: "#34d399" }}>
        Odgovor poslan.
      </p>
    );
  }

  return (
    <form
      action={action}
      className="mt-3 flex flex-col gap-2 pt-3 border-t"
      style={{ borderColor: "var(--od-hairline)" }}
    >
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setMessage(t.text)}
            className="owner-pill owner-pill-neutral"
            style={{ cursor: "pointer", border: "none" }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        required
        className="owner-input text-sm"
        placeholder="Napiši odgovor ili odaberi predložak iznad…"
      />
      {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !message.trim()} className="owner-btn-primary text-xs px-4 py-1.5">
          {pending ? "Šaljem…" : "Pošalji"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold"
          style={{ color: "var(--od-ink-faint)" }}
        >
          Odustani
        </button>
      </div>
    </form>
  );
}

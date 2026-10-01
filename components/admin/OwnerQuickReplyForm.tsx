"use client";

import { useActionState, useState, type ReactNode } from "react";
import { sendInquiryReplyAction, type ActionState } from "@/lib/actions";

/** Predlošci se personaliziraju imenom gosta i cijenom "od" (plan #40). */
function buildTemplates(guestName: string, priceFromEur: number | null) {
  const first = guestName.trim().split(/\s+/)[0] ?? "";
  const hello = first ? `Pozdrav ${first}, hvala na upitu!` : "Pozdrav, hvala na upitu!";
  const price = priceFromEur ? ` Cijena je od ${priceFromEur} € po noći, ovisno o terminu i broju gostiju.` : "";
  return [
    {
      label: "Termin slobodan",
      text: `${hello} Traženi termin je slobodan.${price} Javi mi broj gostiju pa ti pošaljem točnu ponudu.`,
    },
    {
      label: "Termin zauzet",
      text: `${hello} Nažalost, traženi termin je već zauzet. Javi ako te zanima neki drugi termin.`,
    },
    {
      label: "Šaljem ponudu",
      text: `${hello}${price} Uskoro ti šaljem detaljnu ponudu s cijenom i slobodnim terminima.`,
    },
  ];
}

/**
 * Stakleni klon QuickReplyForm.tsx — NAMJERNO odvojena komponenta (vidi
 * OwnerReservationForm za obrazloženje). "Odgovori" je glavni gumb, a
 * secondaryActions (pročitano/odgovoreno) stoje tiho pored njega.
 */
export default function OwnerQuickReplyForm({
  inquiryId,
  guestName = "",
  priceFromEur = null,
  secondaryActions,
}: {
  inquiryId: number;
  guestName?: string;
  priceFromEur?: number | null;
  secondaryActions?: ReactNode;
}) {
  const TEMPLATES = buildTemplates(guestName, priceFromEur);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    sendInquiryReplyAction.bind(null, inquiryId),
    undefined
  );

  if (!open) {
    return (
      <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
        <button type="button" onClick={() => setOpen(true)} className="owner-btn-primary text-sm px-5 py-2">
          Odgovori
        </button>
        {secondaryActions}
      </div>
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

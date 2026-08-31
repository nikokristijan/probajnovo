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

/** Slanje brzog odgovora gostu izravno iz sustava (predložak ili slobodan
    tekst) — vidi lib/actions.ts sendInquiryReplyAction. Skriveno/collapsed
    dok admin ne klikne "Odgovori" da ne zatrpa svaki redak upita. */
export default function QuickReplyForm({ inquiryId }: { inquiryId: number }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(
    sendInquiryReplyAction.bind(null, inquiryId),
    undefined
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-black/50 border border-black/15 rounded-full px-3 py-1.5 hover:border-black/40"
      >
        Odgovori
      </button>
    );
  }

  if (state?.success) {
    return <p className="text-xs font-semibold text-green-700 mt-2">Odgovor poslan.</p>;
  }

  return (
    <form action={action} className="mt-3 flex flex-col gap-2 border-t border-black/10 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setMessage(t.text)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-black/5 hover:bg-black/10"
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
        className="admin-input text-sm"
        placeholder="Napiši odgovor ili odaberi predložak iznad…"
      />
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending || !message.trim()}
          className="text-xs font-semibold text-white bg-black rounded-full px-4 py-1.5 disabled:opacity-50"
        >
          {pending ? "Šaljem…" : "Pošalji"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-black/40 hover:text-black"
        >
          Odustani
        </button>
      </div>
    </form>
  );
}

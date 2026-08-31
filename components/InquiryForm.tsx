"use client";

import { useActionState } from "react";
import { createInquiryAction, type ActionState } from "@/lib/actions";

/**
 * Obrazac za upit na stranici vikendice/firme — sprema se u bazu (tablica
 * `inquiries`) i vidljiv je u /admin/inquiries. Ne zamjenjuje postojeće
 * mailto/tel/WhatsApp gumbe (i dalje rade odmah, bez čekanja na admina),
 * nego nudi dodatan, "službeni" način slanja upita koji ostaje zabilježen.
 */
export default function InquiryForm({
  source,
  sourceId,
  sourceName,
}: {
  source: "property" | "company" | "agency";
  sourceId?: number | null;
  sourceName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createInquiryAction,
    undefined
  );

  if (state?.success) {
    return (
      <div className="stay-inquiry-done" role="status">
        Hvala! Poruka je poslana — javljamo se uskoro.
      </div>
    );
  }

  return (
    <form action={formAction} className="stay-inquiry-form">
      <input type="hidden" name="source" value={source} />
      {sourceId != null && <input type="hidden" name="sourceId" value={sourceId} />}
      <input type="hidden" name="sourceName" value={sourceName} />

      {/* Honeypot — sakriveno od ljudi, botovi ga često ispune. */}
      <div className="stay-inquiry-hp" aria-hidden="true">
        <label>
          Ne popunjavaj ovo polje
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="stay-inquiry-row">
        <label className="stay-inquiry-field">
          <span>Ime i prezime</span>
          <input type="text" name="name" required maxLength={200} autoComplete="name" />
        </label>
        <label className="stay-inquiry-field">
          <span>Email</span>
          <input type="email" name="email" required maxLength={200} autoComplete="email" />
        </label>
      </div>

      <label className="stay-inquiry-field">
        <span>Telefon (opcionalno)</span>
        <input type="tel" name="phone" maxLength={40} autoComplete="tel" />
      </label>

      <label className="stay-inquiry-field">
        <span>Poruka</span>
        <textarea name="message" required maxLength={4000} rows={4} />
      </label>

      {state?.error && <p className="stay-inquiry-error">{state.error}</p>}

      <button type="submit" className="stay-inquiry-submit" disabled={pending}>
        {pending ? "Šalje se…" : "Pošalji poruku"}
      </button>
    </form>
  );
}

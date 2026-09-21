"use client";

import { useActionState } from "react";
import { createInquiryAction, type ActionState } from "@/lib/actions";

/**
 * Vikendice/firme imaju svoju wildcard poddomenu "<slug>.<APEX_HOST>" (vidi
 * proxy.ts) koja iznutra rewrita SAMO "/" na "/<slug>" — "/privatnost" bi se
 * na toj poddomeni prevelo u nepostojeći "/<slug>/privatnost" (404). Zato ovaj
 * link uvijek ide na apex domenu eksplicitno, isti obrazac kao propertyUrl()
 * u NovoHome.tsx. Dok APEX_HOST nije postavljen (lokalni razvoj), pada natrag
 * na relativni put.
 */
const APEX_HOST = process.env.NEXT_PUBLIC_APEX_HOST || "";
const PRIVACY_POLICY_URL = APEX_HOST ? `https://${APEX_HOST}/privatnost` : "/privatnost";

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
  lang = "hr",
  ctaLabel,
}: {
  source: "property" | "company" | "agency" | "product";
  sourceId?: number | null;
  sourceName: string;
  lang?: "hr" | "en";
  /** Prilagođen tekst gumba za slanje (npr. proizvod s vlastitim CTA tekstom).
      Undefined/prazno = zadani "Pošalji poruku"/"Send message". */
  ctaLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createInquiryAction,
    undefined
  );
  const L = (hr: string, en: string) => (lang === "en" ? en : hr);

  if (state?.success) {
    return (
      <div className="stay-inquiry-done" role="status">
        {L("Hvala! Poruka je poslana — javljamo se uskoro.", "Thanks! Your message is on its way — we'll be in touch soon.")}
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
          {L("Ne popunjavaj ovo polje", "Leave this field empty")}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="stay-inquiry-row">
        <label className="stay-inquiry-field">
          <span>{L("Ime i prezime", "Full name")}</span>
          <input type="text" name="name" required maxLength={200} autoComplete="name" />
        </label>
        <label className="stay-inquiry-field">
          <span>Email</span>
          <input type="email" name="email" required maxLength={200} autoComplete="email" />
        </label>
      </div>

      <label className="stay-inquiry-field">
        <span>{L("Telefon (opcionalno)", "Phone (optional)")}</span>
        <input type="tel" name="phone" maxLength={40} autoComplete="tel" />
      </label>

      <label className="stay-inquiry-field">
        <span>{L("Poruka", "Message")}</span>
        <textarea name="message" required maxLength={4000} rows={4} />
      </label>

      <label className="stay-inquiry-consent">
        <input type="checkbox" name="consent" required />
        <span>
          {L("Slažem se s ", "I agree to the ")}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
            {L("politikom privatnosti", "privacy policy")}
          </a>
          {L(" i obradom mojih podataka radi odgovora na upit.", " and processing my data to reply to this inquiry.")}
        </span>
      </label>

      {state?.error && <p className="stay-inquiry-error">{state.error}</p>}

      <button type="submit" className="stay-inquiry-submit" disabled={pending}>
        {pending ? L("Šalje se…", "Sending…") : ctaLabel || L("Pošalji poruku", "Send message")}
      </button>
    </form>
  );
}

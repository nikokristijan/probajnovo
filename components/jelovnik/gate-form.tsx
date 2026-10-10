"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { enterMenuAction, submitMenuGate, type GateResult } from "@/app/jelovnik/[slug]/actions";
import { GATE_LIMITS, GATE_MESSAGES } from "./constants";

const PHONE_HINT = "Hrvatski broj upišite ovako: 091 234 5678. Strani broj počnite s + i pozivnim brojem, npr. +49 151 2345678.";

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="jl-btn" disabled={pending} aria-busy={pending}>
      {pending && <span className="jl-spin" aria-hidden />}
      {pending ? "Otvaramo jelovnik…" : "Otvori jelovnik"}
    </button>
  );
}

/**
 * Obrazac na vratima jelovnika: broj mobitela, obavezna neoznačena privola i skriveno polje za botove.
 *
 * Bez JavaScripta (i prije hidracije) obrazac se šalje izvorno na akciju poslužitelja, koja pri grešci vraća
 * stranicu s ?greska=... (to dolazi kao `initial`). Uz JavaScript šaljemo sami: provjera u pregledniku, greške
 * odmah ispod polja, fokus na polje s greškom, stanje "Otvaramo jelovnik" i bez ponovnog učitavanja stranice.
 * Privola je u dva sloja (kratka rečenica uz kvačicu + "Pročitaj više"); zajedno čine točno onaj tekst koji poslužitelj sprema kao dokaz.
 */
export function GateForm({
  slug,
  table,
  consentSummary,
  consentDetails,
  initial,
}: {
  slug: string;
  table: string | null;
  consentSummary: string;
  consentDetails: string;
  initial: GateResult | null;
}) {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  // Poruka koja se trenutno prikazuje: greška iz URL-a (bez JS-a), iz preglednika ili s poslužitelja.
  const [notice, setNotice] = useState<GateResult | null>(initial);
  const [pending, startTransition] = useTransition();
  const phoneRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  function show(result: GateResult) {
    setNotice(result);
    (result.field === "consent" ? consentRef.current : phoneRef.current)?.focus();
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Uz JavaScript šaljemo sami (a ne preko action={...}): React bi inače nakon odgovora poništio obrazac i brisao
    // označenu privolu. Ako hidracije još nema, ovo se ne izvršava i obrazac ide izvorno na akciju poslužitelja.
    e.preventDefault();
    if (pending) return;
    if (phone.replace(/\D/g, "").length < 6) return show({ error: GATE_MESSAGES.phone, field: "phone" });
    if (!consent) return show({ error: GATE_MESSAGES.consent, field: "consent" });
    setNotice(null);
    const data = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        // Na uspjehu akcija preusmjerava na jelovnik; vraća se samo greška.
        const result = await submitMenuGate(data);
        if (result?.error) show(result);
      } catch {
        show({ error: GATE_MESSAGES.generic, field: null });
      }
    });
  }

  const phoneError = notice?.field === "phone" ? notice.error : null;
  const consentError = notice?.field === "consent" ? notice.error : null;
  const otherError = notice && notice.field === null ? notice.error : null;

  return (
    <form action={enterMenuAction} onSubmit={onSubmit} noValidate className="jl-form">
      <input type="hidden" name="slug" value={slug} />
      {table && <input type="hidden" name="stol" value={table} />}

      {/* Polje za botove: ljudima je nevidljivo i izvan tab-redoslijeda. Ispunjeno polje = lažni uspjeh bez spremanja. */}
      <div className="jl-hp" aria-hidden="true">
        <label>
          Ne popunjavajte ovo polje
          <input type="text" name="web" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      <div className="jl-field">
        <label htmlFor="jl-phone" className="jl-label">
          Broj mobitela
        </label>
        <input
          ref={phoneRef}
          id="jl-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="091 234 5678"
          maxLength={GATE_LIMITS.phone}
          required
          aria-required="true"
          aria-invalid={phoneError ? true : undefined}
          aria-describedby={phoneError ? "jl-phone-error jl-phone-hint" : "jl-phone-hint"}
          autoFocus={initial?.field === "phone"}
          className="jl-input"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setNotice(null);
          }}
        />
        <p id="jl-phone-hint" className="jl-hint">
          {PHONE_HINT}
        </p>
        {phoneError && (
          <p id="jl-phone-error" role="alert" className="jl-error">
            {phoneError}
          </p>
        )}
      </div>

      <div className={consentError ? "jl-consent has-error" : "jl-consent"}>
        <label className="jl-check">
          <input
            ref={consentRef}
            type="checkbox"
            name="consent"
            value="1"
            required
            aria-required="true"
            aria-invalid={consentError ? true : undefined}
            aria-describedby={consentError ? "jl-consent-error" : undefined}
            autoFocus={initial?.field === "consent"}
            checked={consent}
            onChange={(e) => {
              setConsent(e.target.checked);
              setNotice(null);
            }}
          />
          <span className="jl-check-text">{consentSummary}</span>
        </label>
        <details className="jl-more">
          <summary>Pročitaj više</summary>
          <p>{consentDetails}</p>
          <p>
            Više o tome kako čuvamo podatke:{" "}
            <a href="/privatnost" target="_blank" rel="noopener">
              Politika privatnosti
            </a>
            .
          </p>
        </details>
        {consentError && (
          <p id="jl-consent-error" role="alert" className="jl-error">
            {consentError}
          </p>
        )}
      </div>

      {otherError && (
        <p role="alert" className="jl-error jl-error-block">
          {otherError}
        </p>
      )}

      <SubmitButton pending={pending} />
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { createInquiryAction, type ActionState } from "@/lib/actions";

const APEX_HOST = process.env.NEXT_PUBLIC_APEX_HOST || "";
const PRIVACY_POLICY_URL = APEX_HOST ? `https://${APEX_HOST}/privatnost` : "/privatnost";
const ATTR_KEY = "novo-attribution";

type AdWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

/**
 * Odakle je posjetitelj došao (utm_* parametri oglasa, gclid/fbclid,
 * referrer). Pamti se PRVI dolazak u ovoj sesiji preglednika, pa i ako
 * gost s oglasa prvo pogleda druge stranice, upit i dalje nosi izvor
 * oglasa. Spaja se uz poruku upita (vidi createInquiryAction).
 */
function readAttribution(): string {
  try {
    const saved = sessionStorage.getItem(ATTR_KEY);
    if (saved) return saved;
  } catch {}
  const q = new URLSearchParams(window.location.search);
  const parts: string[] = [];
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
    const v = q.get(k);
    if (v) parts.push(`${k.replace("utm_", "")}=${v}`);
  }
  if (q.get("fbclid")) parts.push("fbclid");
  if (q.get("gclid")) parts.push("gclid");
  let ref = "";
  try {
    if (document.referrer && new URL(document.referrer).host !== window.location.host) {
      ref = new URL(document.referrer).host;
    }
  } catch {}
  if (ref) parts.push(`ref=${ref}`);
  const value = parts.length ? `${parts.join(" · ")} · ${window.location.pathname}` : "";
  try {
    if (value) sessionStorage.setItem(ATTR_KEY, value);
  } catch {}
  return value;
}

/**
 * Upit za proizvod u NOVO stilu: količina s okvirnim izračunom, naziv
 * objekta i poruka se slažu u jednu poruku za /admin/inquiries.
 */
export default function ProductInquiryNovo({
  productId,
  productName,
  priceEur,
  ctaLabel,
}: {
  productId: number;
  productName: string;
  priceEur: number | null;
  ctaLabel?: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createInquiryAction, undefined);
  const [qty, setQty] = useState(1);
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [attribution, setAttribution] = useState("");

  useEffect(() => {
    // sessionStorage/URL postoje tek u pregledniku.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttribution(readAttribution());
  }, []);

  // Konverzija za oglase (ako je na stranici Meta Pixel / Google tag).
  useEffect(() => {
    if (!state?.success) return;
    const w = window as AdWindow;
    w.fbq?.("track", "Lead", { content_name: productName });
    w.gtag?.("event", "generate_lead", { item_name: productName });
    w.dataLayer?.push({ event: "product_inquiry", product: productName, quantity: qty });
  }, [state?.success, productName, qty]);

  if (state?.success) {
    return (
      <div className="pq-done" role="status">
        <span className="novo-os-kicker mono">UPIT JE POSLAN</span>
        <p>
          Hvala! Javljamo se{email ? ` na ${email}` : ""} unutar 24 sata s točnom cijenom za {qty} kom.
        </p>
      </div>
    );
  }

  const message = [
    `Proizvod: ${productName}`,
    `Količina: ${qty}`,
    place.trim() ? `Objekt: ${place.trim()}` : null,
    note.trim() ? `\n${note.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const clampQty = (n: number) => Math.min(999, Math.max(1, Math.round(n) || 1));

  return (
    <form action={formAction} className="pq-form">
      <input type="hidden" name="source" value="product" />
      <input type="hidden" name="sourceId" value={productId} />
      <input type="hidden" name="sourceName" value={productName} />
      <input type="hidden" name="message" value={message} />
      <input type="hidden" name="attribution" value={attribution} />

      <div className="stay-inquiry-hp" aria-hidden="true">
        <label>
          Ne popunjavaj ovo polje
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="pq-qty-row">
        <div className="pq-field">
          <span className="pq-label mono" id="pq-qty-label">
            KOLIČINA
          </span>
          <div className="pq-stepper" role="group" aria-labelledby="pq-qty-label">
            <button type="button" onClick={() => setQty((q) => clampQty(q - 1))} aria-label="Manje" disabled={qty <= 1}>
              −
            </button>
            <input
              id="pq-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={qty}
              onChange={(e) => setQty(clampQty(Number(e.target.value)))}
              aria-labelledby="pq-qty-label"
            />
            <button type="button" onClick={() => setQty((q) => clampQty(q + 1))} aria-label="Više">
              +
            </button>
          </div>
        </div>
        {priceEur != null && (
          <div className="pq-estimate" aria-live="polite">
            <span className="pq-label mono">OKVIRNO</span>
            <span className="pq-estimate-sum">{(qty * priceEur).toLocaleString("hr-HR")} €</span>
            <span className="pq-estimate-calc mono">
              {qty} × {priceEur} €
            </span>
          </div>
        )}
      </div>
      {priceEur != null && (
        <p className="pq-hint">Cijena može varirati ovisno o količini. Točan iznos potvrđujemo u odgovoru.</p>
      )}

      <div className="pq-grid">
        <label className="pq-field">
          <span className="pq-label mono">IME I PREZIME *</span>
          <input id="pq-name" type="text" name="name" required maxLength={200} autoComplete="name" />
        </label>
        <label className="pq-field">
          <span className="pq-label mono">EMAIL *</span>
          <input
            id="pq-email"
            type="email"
            name="email"
            required
            maxLength={200}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="pq-field">
          <span className="pq-label mono">TELEFON</span>
          <input id="pq-phone" type="tel" name="phone" maxLength={40} autoComplete="tel" />
        </label>
        <label className="pq-field">
          <span className="pq-label mono">NAZIV OBJEKTA</span>
          <input
            id="pq-place"
            type="text"
            maxLength={120}
            placeholder="npr. Apartman Lozica"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
        </label>
      </div>

      <label className="pq-field">
        <span className="pq-label mono">PORUKA</span>
        <textarea
          id="pq-note"
          rows={3}
          maxLength={3000}
          placeholder="Boja, natpis, rok… sve što nam pomaže pripremiti ponudu."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <label className="pq-consent">
        <input id="pq-consent" type="checkbox" name="consent" required />
        <span>
          Slažem se s{" "}
          <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer">
            politikom privatnosti
          </a>{" "}
          i obradom podataka radi odgovora na upit.
        </span>
      </label>

      {state?.error && (
        <p className="pq-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="novo-os-cta mono pq-submit" disabled={pending}>
        {pending ? "ŠALJEM…" : (ctaLabel?.trim() || "Pošalji upit").toUpperCase() + " →"}
      </button>
    </form>
  );
}

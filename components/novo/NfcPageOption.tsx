"use client";

import { useEffect, useState } from "react";

export type NfcTarget = "novo" | "own";
export const NFC_TARGET_EVENT = "novo:nfc-target";

/** Zajednički izbor (gore uz cijenu i dolje u obrascu) — sinkronizira se eventom. */
export function useNfcTarget(initial: NfcTarget = "novo") {
  const [target, setTarget] = useState<NfcTarget>(initial);
  useEffect(() => {
    const on = (e: Event) => setTarget((e as CustomEvent<NfcTarget>).detail);
    window.addEventListener(NFC_TARGET_EVENT, on);
    return () => window.removeEventListener(NFC_TARGET_EVENT, on);
  }, []);
  const choose = (t: NfcTarget) => {
    setTarget(t);
    window.dispatchEvent(new CustomEvent(NFC_TARGET_EVENT, { detail: t }));
  };
  return [target, choose] as const;
}

export function nfcTargetLabel(t: NfcTarget, monthly: number) {
  return t === "novo"
    ? `Naša stranica za goste (održavanje ${monthly} €/mj)`
    : "Pločica vodi na vlastitu stranicu kupca (bez mjesečne naknade)";
}

/**
 * "Kamo vodi pločica?" — dvije opcije: NOVO stranica za goste (mjesečno
 * održavanje) ili kupčeva postojeća stranica (bez naknade). Isti izbor se
 * prikazuje uz cijenu i u obrascu za upit.
 */
export default function NfcPageOption({
  monthlyEur,
  idPrefix,
  previewHref,
}: {
  monthlyEur: number;
  idPrefix: string;
  /** Poveznica na prikaz stranice za goste (npr. "#stranica"), ako postoji na stranici. */
  previewHref?: string;
}) {
  const [target, choose] = useNfcTarget();
  const opts: { value: NfcTarget; title: string; price: string; hint: string }[] = [
    {
      value: "novo",
      title: "Naša stranica",
      price: `+${monthlyEur} €/mj`,
      hint: "WiFi, QR kod, recenzije, kućni red i preporuke. Postavljamo i održavamo mi.",
    },
    {
      value: "own",
      title: "Vaša stranica",
      price: "bez naknade",
      hint: "Pločica otvara vaš web, Booking oglas, Instagram ili bilo koju poveznicu.",
    },
  ];
  return (
    <fieldset className="nfco">
      <legend className="pq-label mono">KAMO VODI PLOČICA?</legend>
      <div className="nfco-row">
        {opts.map((o) => (
          <label
            key={o.value}
            className={target === o.value ? "nfco-opt is-on" : "nfco-opt"}
            htmlFor={`${idPrefix}-${o.value}`}
            title={o.hint}
          >
            <input
              id={`${idPrefix}-${o.value}`}
              type="radio"
              name={`${idPrefix}-nfc-target`}
              value={o.value}
              checked={target === o.value}
              onChange={() => choose(o.value)}
              aria-describedby={`${idPrefix}-${o.value}-hint`}
            />
            <span className="nfco-title">{o.title}</span>
            <span className="nfco-price">{o.price}</span>
            <span id={`${idPrefix}-${o.value}-hint`} className="sr-only">
              {o.hint}
            </span>
          </label>
        ))}
      </div>
      {previewHref && (
        <a href={previewHref} className="nfco-more">
          Kako izgleda naša stranica? ↓
        </a>
      )}
    </fieldset>
  );
}

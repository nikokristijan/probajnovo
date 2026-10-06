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
export default function NfcPageOption({ monthlyEur, idPrefix }: { monthlyEur: number; idPrefix: string }) {
  const [target, choose] = useNfcTarget();
  const opts: { value: NfcTarget; title: string; text: string; price: string }[] = [
    {
      value: "novo",
      title: "Naša stranica za goste",
      text: "WiFi s kopiranjem lozinke, QR kod, Google recenzija, kućni red i preporuke. Izmjene radimo mi.",
      price: `${monthlyEur} € / mj održavanje`,
    },
    {
      value: "own",
      title: "Vaša postojeća stranica",
      text: "Pločica otvara vaš web, Booking oglas, Instagram ili bilo koju poveznicu.",
      price: "bez mjesečne naknade",
    },
  ];
  return (
    <fieldset className="nfco">
      <legend className="pq-label mono">KAMO VODI PLOČICA?</legend>
      <div className="nfco-row">
        {opts.map((o) => (
          <label key={o.value} className={target === o.value ? "nfco-opt is-on" : "nfco-opt"} htmlFor={`${idPrefix}-${o.value}`}>
            <input
              id={`${idPrefix}-${o.value}`}
              type="radio"
              name={`${idPrefix}-nfc-target`}
              value={o.value}
              checked={target === o.value}
              onChange={() => choose(o.value)}
            />
            <span className="nfco-title">{o.title}</span>
            <span className="nfco-text">{o.text}</span>
            <span className="nfco-price mono">{o.price.toUpperCase()}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

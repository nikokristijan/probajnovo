"use client";

import { useState } from "react";

/** Kopira dani tekst u međuspremnik i na 1.5s prikaže "Kopirano" na gumbu —
    koristi se za SSID i lozinku na /nfc/[slug] stranici (gost često treba
    zalijepiti točno oboje u telefonski WiFi izbornik, ne samo pročitati). */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Bez clipboard API-ja (rijetko, stari preglednik) — gost i dalje
      // vidi tekst na ekranu i može ga ručno prepisati, nema fallback UI-a.
    }
  }

  return (
    <button
      type="button"
      className="nfc-copy-btn"
      data-copied={copied}
      onClick={handleCopy}
    >
      {copied ? "Kopirano ✓" : "Kopiraj"}
    </button>
  );
}

export function NfcSsidRow({ ssid }: { ssid: string }) {
  return (
    <div className="nfc-wifi-row">
      <div>
        <div className="nfc-wifi-label">Mreža</div>
        <div className="nfc-wifi-value">{ssid}</div>
      </div>
      <CopyButton text={ssid} />
    </div>
  );
}

export function NfcPasswordRow({ password }: { password: string | null }) {
  if (!password) {
    return (
      <div className="nfc-wifi-row">
        <div className="nfc-wifi-label">Lozinka</div>
        <span className="nfc-open-badge">Otvorena mreža — nije potrebna</span>
      </div>
    );
  }
  return (
    <div className="nfc-wifi-row">
      <div>
        <div className="nfc-wifi-label">Lozinka</div>
        <div className="nfc-wifi-value">{password}</div>
      </div>
      <CopyButton text={password} />
    </div>
  );
}

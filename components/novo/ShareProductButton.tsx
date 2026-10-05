"use client";

import { useState } from "react";

/** Kopira (ili na mobitelu dijeli) čistu adresu proizvoda, bez utm parametara. */
export default function ShareProductButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await nav.share({ title, url });
        return;
      } catch {
        // korisnik je odustao — padamo na kopiranje
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Kopiraj adresu proizvoda:", url);
    }
  };

  return (
    <button type="button" className="mono link link-btn pd-share" onClick={onClick}>
      {copied ? "LINK KOPIRAN ✓" : "PODIJELI LINK ↗"}
    </button>
  );
}

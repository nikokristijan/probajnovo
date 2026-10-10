"use client";

import { useState } from "react";

/**
 * Kratka potvrda nakon unosa broja (fiksna traka pri dnu, bez pomicanja sadržaja). Sama se sakrije CSS animacijom
 * nekoliko sekundi nakon prikaza (radi i bez JavaScripta), a gumb je zatvara odmah. Tekst je običan React tekst.
 */
export function FlashNotice({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="jl-flash" role="status" onAnimationEnd={() => setOpen(false)}>
      <p className="jl-flash-text">{text}</p>
      <button type="button" className="jl-flash-x" onClick={() => setOpen(false)} aria-label="Zatvori obavijest">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

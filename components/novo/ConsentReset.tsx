"use client";

import { useState } from "react";
import { CONSENT_KEY, CONSENT_RESET_EVENT } from "@/components/novo/ConsentTracking";

/** Gumb na /kolacici: briše spremljeni izbor pa se baner ponovno pojavi. */
export default function ConsentReset() {
  const [done, setDone] = useState(false);
  return (
    <p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.removeItem(CONSENT_KEY);
          } catch {}
          window.dispatchEvent(new Event(CONSENT_RESET_EVENT));
          setDone(true);
        }}
        style={{ font: "inherit", textDecoration: "underline", background: "none", border: 0, padding: 0, cursor: "pointer" }}
      >
        Promijeni postavke kolačića
      </button>
      {done && " — izbor je poništen, baner će se ponovno prikazati na stranicama NOVO-a."}
    </p>
  );
}

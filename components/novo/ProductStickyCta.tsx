"use client";

import { useEffect, useState } from "react";
import { ContactLink, WhatsAppIcon } from "@/components/novo/ProductContactLinks";

/**
 * Mobitel: cijena i glavni gumb pri dnu ekrana. Pojavi se tek kad korisnik
 * odskrola ispod glavnog gumba, a skrije se kad je obrazac za upit na ekranu,
 * da se isti gumb nikad ne vidi dvaput.
 */
export default function ProductStickyCta({
  price,
  label = "POŠALJI UPIT",
  whatsappHref,
  productName = "",
}: {
  price: string;
  label?: string;
  whatsappHref?: string | null;
  productName?: string;
}) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const cta = document.querySelector(".pq-pick-actions");
    const form = document.getElementById("upit");
    if (typeof IntersectionObserver === "undefined" || (!cta && !form)) return;
    // Glavni gumb drži traku skrivenom dok je vidljiv ili još ispod ekrana.
    let ctaHides = cta != null;
    let formHides = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.target === cta) ctaHides = e.isIntersecting || e.boundingClientRect.top > 0;
          if (e.target === form) formHides = e.isIntersecting;
        }
        setHidden(ctaHides || formHides);
      },
      { threshold: 0 }
    );
    if (cta) io.observe(cta);
    if (form) io.observe(form);
    return () => io.disconnect();
  }, []);

  return (
    <div className={hidden ? "pd-sticky is-hidden" : "pd-sticky"} aria-hidden={hidden}>
      <span className="pd-sticky-price">{price}</span>
      <span className="pd-sticky-actions">
        {whatsappHref && (
          <ContactLink
            href={whatsappHref}
            productName={productName}
            channel="whatsapp"
            className="pd-sticky-wa"
            ariaLabel="Pitajte na WhatsAppu"
            tabIndex={hidden ? -1 : undefined}
          >
            <WhatsAppIcon size={20} />
          </ContactLink>
        )}
        <a href="#upit" className="novo-os-cta mono" tabIndex={hidden ? -1 : undefined}>
          {label} ↓
        </a>
      </span>
    </div>
  );
}

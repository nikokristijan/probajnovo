"use client";

import { useEffect, useState } from "react";
import { ContactLink, WhatsAppIcon } from "@/components/novo/ProductContactLinks";

/** Mobitel: cijena i "Pošalji upit" pri dnu ekrana, skriveno dok je obrazac za upit na ekranu. */
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
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById("upit");
    if (!target || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting), { threshold: 0.05 });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div className={formVisible ? "pd-sticky is-hidden" : "pd-sticky"} aria-hidden={formVisible}>
      <span className="pd-sticky-price">{price}</span>
      <span className="pd-sticky-actions">
        {whatsappHref && (
          <ContactLink
            href={whatsappHref}
            productName={productName}
            channel="whatsapp"
            className="pd-sticky-wa"
            ariaLabel="Pitajte na WhatsAppu"
            tabIndex={formVisible ? -1 : undefined}
          >
            <WhatsAppIcon size={20} />
          </ContactLink>
        )}
        <a href="#upit" className="novo-os-cta mono" tabIndex={formVisible ? -1 : undefined}>
          {label} ↓
        </a>
      </span>
    </div>
  );
}

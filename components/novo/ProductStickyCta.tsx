"use client";

import { useEffect, useState } from "react";

/** Mobitel: cijena i "Pošalji upit" pri dnu ekrana, skriveno dok je obrazac za upit na ekranu. */
export default function ProductStickyCta({ price }: { price: string }) {
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
      <a href="#upit" className="novo-os-cta mono" tabIndex={formVisible ? -1 : undefined}>
        POŠALJI UPIT ↓
      </a>
    </div>
  );
}

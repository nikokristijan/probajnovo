"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Znak lokala na vrhu vrata i jelovnika: logo ako ga lokal ima, inače naziv lokala elegantnim fontom. Uvijek je to h1
 * (logo nosi naziv lokala u alt-u). Okvir logotipa je stalne veličine (200 x 64), pa učitavanje slike ne pomiče stranicu.
 * Ako se slika ne može učitati (neispravna adresa, slika obrisana), tiho se prikazuje naziv lokala.
 */
export function Brand({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  // Greška slike koja se dogodi prije hidracije React ne vidi, pa se stanje provjeri i ovdje. SVG bez ugrađene veličine
  // u nekim preglednicima ima naturalWidth 0 iako je ispravan, zato se SVG ne proglašava neispravnim.
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0 && !/\.svg(\?|$)/i.test(el.currentSrc || el.src)) setFailed(true);
  }, [logoUrl]);

  if (logoUrl && !failed) {
    return (
      <h1 className="jl-brand jl-brand-logo">
        {/* Običan <img>: adresa može biti bilo koja https slika, pa next/image (popis dopuštenih domena) ne dolazi u obzir. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={ref}
          src={logoUrl}
          alt={name}
          width={200}
          height={64}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </h1>
    );
  }
  return <h1 className="jl-brand jl-brand-name">{name}</h1>;
}

"use client";

import { useState } from "react";
import Image from "next/image";

/** Jednostavna galerija za /proizvodi/[slug] — glavna slika + traka
    minijatura ispod, klik mijenja glavnu sliku. Odvojeno od GalleryLightbox
    (koji je za punu lightbox galeriju vikendice) jer ovdje ne treba
    fullscreen prikaz, samo brzi pregled prije slanja upita. */
export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="novo-product-media-main" aria-hidden="true" />;
  }

  return (
    <div className="novo-product-media">
      <div className="novo-product-media-main">
        <Image
          src={images[active] ?? images[0]}
          alt={name}
          fill
          sizes="(max-width: 780px) 100vw, 540px"
          priority
        />
      </div>
      {images.length > 1 && (
        <div className="novo-product-thumbs">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={i === active ? "novo-product-thumb active" : "novo-product-thumb"}
              onClick={() => setActive(i)}
              aria-label={`Slika ${i + 1}`}
            >
              <Image src={src} alt="" fill sizes="64px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

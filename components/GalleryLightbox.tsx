"use client";

import { useEffect, useState } from "react";

/** Galerija slika vikendice — klik otvara lightbox s navigacijom lijevo/desno. */
export default function GalleryLightbox({ images, alt }: { images: string[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((v) => (v === null ? v : (v + 1) % images.length));
      if (e.key === "ArrowLeft")
        setOpen((v) => (v === null ? v : (v - 1 + images.length) % images.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

  return (
    <>
      <div className="stay-gallery">
        {images.map((src, i) => (
          <button
            key={src + i}
            className="stay-gallery-item"
            onClick={() => setOpen(i)}
            aria-label={`Otvori sliku ${i + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} className="stay-gallery-img" />
          </button>
        ))}
      </div>

      {open !== null && (
        <div className="stay-lightbox" onClick={() => setOpen(null)}>
          <button
            className="stay-lightbox-close"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(null);
            }}
            aria-label="Zatvori"
          >
            ×
          </button>
          {images.length > 1 && (
            <button
              className="stay-lightbox-nav stay-lightbox-prev"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => (v === null ? v : (v - 1 + images.length) % images.length));
              }}
              aria-label="Prethodna slika"
            >
              ‹
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[open]}
            alt={alt}
            className="stay-lightbox-img"
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <button
              className="stay-lightbox-nav stay-lightbox-next"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => (v === null ? v : (v + 1) % images.length));
              }}
              aria-label="Sljedeća slika"
            >
              ›
            </button>
          )}
          <span className="stay-lightbox-count">
            {open + 1} / {images.length}
          </span>
        </div>
      )}
    </>
  );
}

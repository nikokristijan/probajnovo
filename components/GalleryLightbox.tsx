"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Galerija slika vikendice — klik otvara lightbox s navigacijom lijevo/desno.
 * Ako je proslijeđen `categories` (url → naziv kategorije, npr. "Interijer"),
 * slike se grupiraju pod podnaslove; inače je prikaz identičan starom, ravnom
 * gridu. Lightbox uvijek navigira kroz sve slike redom, bez obzira na grupu.
 */
export default function GalleryLightbox({
  images,
  alt,
  categories,
}: {
  images: string[];
  alt: string;
  categories?: Record<string, string>;
}) {
  const [open, setOpen] = useState<number | null>(null);

  const groups = useMemo(() => {
    if (!categories || Object.keys(categories).length === 0) return null;
    const order: string[] = [];
    const byLabel = new Map<string, { src: string; index: number }[]>();
    images.forEach((src, index) => {
      const label = categories[src]?.trim();
      const key = label || "Ostalo";
      if (!byLabel.has(key)) {
        byLabel.set(key, []);
        order.push(key);
      }
      byLabel.get(key)!.push({ src, index });
    });
    // "Ostalo" (nekategorizirano) uvijek zadnje, ako postoji uz prave kategorije
    if (order.length <= 1) return null; // sve u jednoj skupini = nema smisla grupirati
    order.sort((a, b) => (a === "Ostalo" ? 1 : b === "Ostalo" ? -1 : 0));
    return order.map((label) => ({ label, items: byLabel.get(label)! }));
  }, [images, categories]);

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

  function Thumb({ src, index }: { src: string; index: number }) {
    return (
      <button
        className="stay-gallery-item"
        onClick={() => setOpen(index)}
        aria-label={`Otvori sliku ${index + 1}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="stay-gallery-img" />
      </button>
    );
  }

  return (
    <>
      {groups ? (
        <div className="stay-gallery-groups">
          {groups.map((g) => (
            <div className="stay-gallery-group" key={g.label}>
              <div className="stay-gallery-group-label">{g.label}</div>
              <div className="stay-gallery">
                {g.items.map(({ src, index }) => (
                  <Thumb src={src} index={index} key={src + index} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="stay-gallery">
          {images.map((src, i) => (
            <Thumb src={src} index={i} key={src + i} />
          ))}
        </div>
      )}

      {open !== null &&
        typeof document !== "undefined" &&
        createPortal(
          // Portal na document.body: nekoliko roditeljskih sekcija ima CSS transform
          // (RevealSection scroll-reveal), a transform na pretku pretvara position:fixed
          // potomke u poziconirane RELATIVNO na tog pretka umjesto na cijeli viewport —
          // zato je lightbox bez portala znao ispasti "zarobljen" u dijelu ekrana.
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
          </div>,
          document.body
        )}
    </>
  );
}

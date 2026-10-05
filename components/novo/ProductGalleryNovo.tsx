"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Galerija stranice proizvoda u NOVO stilu: vodoravna traka slika sa
 * "snap" pomicanjem (prstom na mobitelu, strelicama ili tipkovnicom),
 * brojač 01 / 03, minijature ispod i pregled preko cijelog zaslona na klik.
 */
export default function ProductGalleryNovo({ images, name }: { images: string[]; name: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(0);
  const total = images.length;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track || total === 0) return;
      const next = (index + total) % total;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      track.scrollTo({ left: next * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
      setActive(next);
    },
    [total]
  );

  // Aktivna slika prati ručno pomicanje (prst / trackpad).
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const i = Math.round(track.scrollLeft / Math.max(track.clientWidth, 1));
        setActive((prev) => (prev === i ? prev : i));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const openZoom = (i: number) => {
    setZoomed(i);
    dialogRef.current?.showModal();
  };

  if (total === 0) {
    return (
      <div className="pg">
        <div className="pg-empty mono" aria-hidden="true">
          FOTOGRAFIJE USKORO
        </div>
      </div>
    );
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="pg">
      <div
        className="pg-stage"
        role="region"
        aria-roledescription="galerija"
        aria-label={`Fotografije: ${name}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            goTo(active + 1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            goTo(active - 1);
          }
        }}
      >
        <div className="pg-track" ref={trackRef}>
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className="pg-slide"
              onClick={() => openZoom(i)}
              aria-label={`Povećaj sliku ${i + 1} od ${total}`}
            >
              <Image
                src={src}
                alt={`${name} — slika ${i + 1}`}
                fill
                sizes="(max-width: 720px) 100vw, (max-width: 1280px) 50vw, 560px"
                priority={i === 0}
              />
            </button>
          ))}
        </div>

        <span className="pg-counter mono" aria-live="polite">
          {pad(active + 1)} / {pad(total)}
        </span>

        {total > 1 && (
          <>
            <button type="button" className="pg-arrow pg-arrow--prev" onClick={() => goTo(active - 1)} aria-label="Prethodna slika">
              ←
            </button>
            <button type="button" className="pg-arrow pg-arrow--next" onClick={() => goTo(active + 1)} aria-label="Sljedeća slika">
              →
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="pg-thumbs">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              className={i === active ? "pg-thumb is-active" : "pg-thumb"}
              onClick={() => goTo(i)}
              aria-label={`Prikaži sliku ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
            >
              <Image src={src} alt="" fill sizes="72px" />
            </button>
          ))}
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="pg-zoom"
        aria-label={`${name} — povećano`}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setZoomed((z) => (z + 1) % total);
          if (e.key === "ArrowLeft") setZoomed((z) => (z - 1 + total) % total);
        }}
      >
        <div className="pg-zoom-bar mono">
          <span>
            {name.toUpperCase()} · {pad(zoomed + 1)} / {pad(total)}
          </span>
          <button type="button" className="fw-btn" onClick={() => dialogRef.current?.close()} aria-label="Zatvori">
            ×
          </button>
        </div>
        <div className="pg-zoom-img">
          <Image src={images[zoomed] ?? images[0]} alt={`${name} — slika ${zoomed + 1}`} fill sizes="100vw" />
        </div>
        {total > 1 && (
          <div className="pg-zoom-nav">
            <button type="button" className="pg-arrow" onClick={() => setZoomed((z) => (z - 1 + total) % total)} aria-label="Prethodna slika">
              ←
            </button>
            <button type="button" className="pg-arrow" onClick={() => setZoomed((z) => (z + 1) % total)} aria-label="Sljedeća slika">
              →
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Video proizvoda kao NOVO "prozor": ne pokreće se sam, nego tek kad posjetitelj
 * stisne play (inače bi stalno trošio memoriju i bateriju). Učitava se samo
 * metapodaci za oblik okvira, a kad ode s ekrana ili završi, staje i oslobađa
 * dekodiranje. Okvir se prilagodi obliku snimke (uspravna snimka s mobitela
 * ostaje uspravna). Gumbi: pauza, zvuk, cijeli zaslon.
 */
export default function ProductVideoNovo({ src, name, poster }: { src: string; name: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(9 / 16);
  const [seconds, setSeconds] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  // Kad video ode s ekrana, pauziraj ga (ne vrti se u pozadini). Nikad ga ne pokreći sam.
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) v.play().catch(() => {});
  };

  const fullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  return (
    <figure className="pv" style={{ "--pv-ratio": ratio } as React.CSSProperties}>
      <div className="pv-bar mono">
        <span className="pv-title">
          <span className={playing ? "pv-dot is-on" : "pv-dot"} aria-hidden="true" />
          {seconds ? `VIDEO · ${seconds} S` : "VIDEO"}
        </span>
        <span className="pv-hint">{muted ? "BEZ ZVUKA" : "ZVUK UKLJUČEN"}</span>
      </div>
      <div className="pv-frame">
        <video
          ref={ref}
          src={src}
          muted
          playsInline
          preload="metadata"
          poster={poster}
          aria-label={`${name} — video`}
          onClick={togglePlay}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
            if (Number.isFinite(v.duration)) setSeconds(Math.max(1, Math.round(v.duration)));
          }}
        />
        {!playing && (
          <button type="button" className="pv-play" onClick={togglePlay} aria-label="Pokreni video">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </button>
        )}
        <div className="pv-controls">
          <button type="button" onClick={togglePlay} aria-label={playing ? "Pauziraj video" : "Pokreni video"}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button type="button" onClick={toggleSound} aria-label={muted ? "Uključi zvuk" : "Isključi zvuk"}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 10v4h4l5 4V6L8 10H4z" fill="currentColor" stroke="none" />
              {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8a5 5 0 0 1 0 8M19.5 5.5a9 9 0 0 1 0 13" />}
            </svg>
          </button>
          <button type="button" onClick={fullscreen} aria-label="Cijeli zaslon">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          </button>
        </div>
      </div>
    </figure>
  );
}

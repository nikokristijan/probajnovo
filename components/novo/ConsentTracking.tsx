"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { flushTrackQueue } from "@/lib/track";

export const CONSENT_KEY = "novo-consent-v1";
export const CONSENT_RESET_EVENT = "novo:consent-reset";

type Consent = "granted" | "denied" | null;

type TagWindow = Window & {
  fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void };
  _fbq?: unknown;
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function addScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

/** Službeni Meta Pixel isječak, samo napisan kao funkcija. */
function loadMetaPixel(pixelId: string) {
  const w = window as TagWindow;
  if (w.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) Reflect.apply(fbq.callMethod, fbq, args);
    else fbq.queue.push(args);
  } as ((...args: unknown[]) => void) & {
    queue: unknown[];
    callMethod?: (...a: unknown[]) => void;
    push?: unknown;
    loaded?: boolean;
    version?: string;
  };
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  w.fbq = fbq;
  if (!w._fbq) w._fbq = fbq;
  addScript("https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", pixelId);
  fbq("track", "PageView");
}

function loadGa(measurementId: string) {
  const w = window as TagWindow;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag() {
    // gtag.js očekuje baš "arguments" objekt, ne niz.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`);
  w.gtag("js", new Date());
  w.gtag("config", measurementId);
}

/**
 * Baner za pristanak + učitavanje Meta Pixela i Google Analyticsa tek nakon
 * "Prihvaćam". Ako admin nije upisao nijedan ID, ne prikazuje ništa (stranica
 * tada nema kolačića koji traže pristanak). Izbor se pamti u pregledniku, a
 * na /kolacici se može poništiti.
 */
export default function ConsentTracking({
  metaPixelId,
  gaMeasurementId,
}: {
  metaPixelId: string | null;
  gaMeasurementId: string | null;
}) {
  const enabled = Boolean(metaPixelId || gaMeasurementId);
  const [consent, setConsent] = useState<Consent | "loading">("loading");

  useEffect(() => {
    if (!enabled) return;
    // localStorage postoji tek u pregledniku.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readConsent());
    const onReset = () => setConsent(null);
    window.addEventListener(CONSENT_RESET_EVENT, onReset);
    return () => window.removeEventListener(CONSENT_RESET_EVENT, onReset);
  }, [enabled]);

  useEffect(() => {
    if (consent !== "granted") return;
    if (metaPixelId) loadMetaPixel(metaPixelId);
    if (gaMeasurementId) loadGa(gaMeasurementId);
    flushTrackQueue();
  }, [consent, metaPixelId, gaMeasurementId]);

  if (!enabled || consent !== null) return null;

  const choose = (v: "granted" | "denied") => {
    try {
      localStorage.setItem(CONSENT_KEY, v);
    } catch {}
    setConsent(v);
  };

  const tools = [metaPixelId && "Meta Pixel", gaMeasurementId && "Google Analytics"].filter(Boolean).join(" i ");

  return (
    <div className="cc" role="dialog" aria-live="polite" aria-labelledby="cc-title">
      <div className="cc-bar mono">
        <span id="cc-title">KOLAČIĆI</span>
        <Link href="/kolacici" className="cc-more">
          VIŠE →
        </Link>
      </div>
      <p className="cc-text">
        Uz vaš pristanak koristimo {tools} za mjerenje oglasa. Stranica radi jednako i bez toga.
      </p>
      <div className="cc-actions">
        <button type="button" className="cc-btn mono" onClick={() => choose("denied")}>
          ODBIJAM
        </button>
        <button type="button" className="cc-btn cc-btn--yes mono" onClick={() => choose("granted")}>
          PRIHVAĆAM
        </button>
      </div>
    </div>
  );
}

/**
 * Događaji za oglase (Meta Pixel + Google Analytics). Ništa se ne šalje dok
 * posjetitelj ne prihvati kolačiće: do tada se događaji samo čuvaju u redu
 * (window.__novoTrackQ), a ConsentTracking ih pošalje nakon učitavanja
 * skripti. Odbije li, red ostaje u memoriji stranice i nestane s njom.
 */

export type TrackEvent = "ViewContent" | "InitiateCheckout" | "Contact" | "Lead";
type Params = Record<string, unknown>;

type TrackWindow = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
  __novoTrackQ?: [TrackEvent, Params][];
};

const GA_NAMES: Record<TrackEvent, string> = {
  ViewContent: "view_item",
  InitiateCheckout: "begin_checkout",
  Contact: "contact",
  Lead: "generate_lead",
};

function send(w: TrackWindow, name: TrackEvent, params: Params) {
  w.fbq?.("track", name, params);
  w.gtag?.("event", GA_NAMES[name], params);
}

export function track(name: TrackEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  const w = window as TrackWindow;
  if (w.fbq || w.gtag) send(w, name, params);
  else (w.__novoTrackQ ??= []).push([name, params]);
}

/** Pošalje događaje skupljene prije pristanka (poziva ConsentTracking). */
export function flushTrackQueue() {
  const w = window as TrackWindow;
  const q = w.__novoTrackQ ?? [];
  w.__novoTrackQ = [];
  for (const [name, params] of q) send(w, name, params);
}

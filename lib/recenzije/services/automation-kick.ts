import "server-only";
import { after } from "next/server";
import { processDueRuns } from "./automation-engine";

let lastKick = 0;
/** Najčešće jednom u toliko ms po procesu: javna stranica jelovnika smije pokrenuti obradu, ali je ne smije zatrpati. */
export const KICK_MIN_INTERVAL_MS = 15_000;

/**
 * Pokreće obradu dospjelih automatizacija NAKON odgovora (next/server after), isto kao radni prostor
 * (app/recenzije/(app)/layout.tsx). Zovite je iz stranice /jelovnik/<slug> i iz akcije unosa broja, da zakazane
 * poruke gostima napreduju i bez vanjskog crona. Sigurno je zvati izvan zahtjeva (testovi): tada ne radi ništa.
 * Ograničena na jedan poziv u KICK_MIN_INTERVAL_MS po procesu.
 */
export function kickDueRuns(limit = 25, now: number = Date.now()): boolean {
  if (now - lastKick < KICK_MIN_INTERVAL_MS) return false;
  try {
    after(() => processDueRuns(limit).catch((e) => console.error("[recenzije] processDueRuns", e)));
    lastKick = now;
    return true;
  } catch {
    return false;
  }
}

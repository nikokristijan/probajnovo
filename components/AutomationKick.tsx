"use client";

import { useEffect } from "react";

const KEY = "novo_kick_at";
/** Najviše jednom u 5 minuta po pregledniku; poslužitelj ionako ograničava na jednom u 15 s. */
const EVERY_MS = 5 * 60_000;

/** Nevidljivo: posjet bilo kojoj stranici sitea pokreće slanje dospjelih zakazanih poruka. */
export default function AutomationKick() {
  useEffect(() => {
    const now = Date.now();
    try {
      const last = Number(sessionStorage.getItem(KEY) ?? 0);
      if (now - last < EVERY_MS) return;
      sessionStorage.setItem(KEY, String(now));
    } catch {
      // bez sessionStorage-a: poslužitelj ionako ograničava učestalost
    }
    fetch("/api/recenzije/kick", { method: "POST", keepalive: true }).catch(() => {});
  }, []);
  return null;
}

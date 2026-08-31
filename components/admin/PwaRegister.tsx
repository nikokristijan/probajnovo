"use client";

import { useEffect } from "react";

/**
 * Registrira minimalni service worker (public/admin-sw.js) samo za /admin
 * rutu, čime preglednik (Android Chrome, i djelomično desktop Chrome/Edge)
 * dozvoljava "Dodaj na početni zaslon" / "Instaliraj aplikaciju" za admin
 * panel — vidi public/admin-manifest.json za ime, ikonice i boje.
 *
 * Renderira se u app/admin/layout.tsx, ne vraća ništa vidljivo — samo
 * pokreće registraciju jednom kad se admin panel učita u pregledniku.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/admin-sw.js", { scope: "/admin" })
      .catch(() => {
        // Best-effort — ako registracija ne uspije (npr. stariji preglednik),
        // admin panel i dalje radi normalno kroz browser, samo bez ikonice.
      });
  }, []);

  return null;
}

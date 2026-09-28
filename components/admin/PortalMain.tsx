"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Glavni sadržaj Portala (Faza 3, /admin/portal) — prebacuje se između
 * "Tim"/"Zadaci"/"Statistika" preko ?tab= (isti izbornik kao
 * PortalSidebar.tsx, samo se ovdje ČITA) bez punog reloada stranice.
 * Slotovi se renderiraju na SERVERU (app/admin/portal/page.tsx) i
 * prosljeđuju ovamo kao gotov JSX — ova komponenta samo bira koji je
 * vidljiv, ne zna ništa o podacima unutra.
 */
export default function PortalMain({
  channelSlot,
  tasksSlot,
  statsSlot,
}: {
  channelSlot: ReactNode;
  tasksSlot: ReactNode;
  statsSlot: ReactNode;
}) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "poruke";

  return (
    <>
      <div style={{ display: tab === "poruke" ? "block" : "none" }}>{channelSlot}</div>
      <div style={{ display: tab === "zadaci" ? "block" : "none" }}>{tasksSlot}</div>
      <div style={{ display: tab === "statistika" ? "block" : "none" }}>{statsSlot}</div>
    </>
  );
}

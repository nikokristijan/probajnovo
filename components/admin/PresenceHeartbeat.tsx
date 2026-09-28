"use client";

import { useEffect } from "react";
import { heartbeatAction } from "@/lib/actions";

/**
 * Nevidljiva komponenta — javlja "još sam tu" svaku minutu dok je puni
 * admin/superadmin negdje u /admin (montirano u app/admin/layout.tsx za
 * role!=="owner", ne samo na /admin/poruke, da "Ured" prati stvarnu
 * aktivnost, ne samo posjete tom jednom tabu). Vidi lib/actions.ts
 * heartbeatAction i app/api/admin/presence (poll s klijenta čita rezultat).
 * Prvi poziv odmah na mount (ne čeka prvi interval), greške tiho ignorira
 * (prisutnost nije kritična funkcija — nikad ne smije rušiti stranicu).
 */
export default function PresenceHeartbeat() {
  useEffect(() => {
    const beat = () => {
      heartbeatAction().catch(() => {});
    };
    beat();
    const id = setInterval(beat, 60_000);
    return () => clearInterval(id);
  }, []);

  return null;
}

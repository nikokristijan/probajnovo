import type { ClientHealth } from "@/lib/db/queries";
import { describeSubscription } from "@/lib/subscriptionState";

export type HealthLevel = "dobro" | "pratiti" | "rizik";

export type ClientHealthScore = ClientHealth & {
  level: HealthLevel;
  /** Kratki razlozi, najvažniji prvi — prikazuju se uz klijenta. */
  reasons: string[];
};

/**
 * Zdravlje klijenta (plan #19) — jednostavna pravila umjesto "pametne"
 * ocjene, da se uvijek vidi ZAŠTO je netko označen:
 *  - kasni s uplatom više od 14 dana → rizik, do 14 → pratiti
 *  - bez posjeta stranice 30 dana → pratiti
 *  - vikendica bez upita 60 dana → pratiti
 *  - vlasnik se nije prijavio 30+ dana (ili nikad) → pratiti
 *  - neobjavljena stranica → pratiti (posjete i upiti se tada ne broje)
 * Tri ili više razloga = rizik.
 */
export function scoreClientHealth(c: ClientHealth, today: string): ClientHealthScore {
  const reasons: string[] = [];
  let risk = false;

  if (c.subscriptionId != null && c.subscriptionStatus && c.nextRenewalDate) {
    const st = describeSubscription(
      { status: c.subscriptionStatus, isTrial: c.subscriptionStatus === "trial", trialEndsAt: null, nextRenewalDate: c.nextRenewalDate },
      today
    );
    if (st.daysLate > 14) {
      risk = true;
      reasons.push(`Uplata kasni ${st.daysLate} dana`);
    } else if (st.daysLate > 0) {
      reasons.push(`Uplata kasni ${st.daysLate} ${st.daysLate === 1 ? "dan" : "dana"}`);
    }
  }
  if (!c.published) {
    reasons.push("Stranica još nije objavljena");
  } else {
    if (c.views30d === 0) reasons.push("Nema posjeta stranice 30 dana");
    if (c.source === "property" && c.inquiries60d === 0) reasons.push("Nema upita 60 dana");
  }
  if (c.ownerCount > 0) {
    if (!c.ownerLastSeen) reasons.push("Vlasnik se još nije prijavio");
    else {
      const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${c.ownerLastSeen}T00:00:00Z`)) / 86_400_000);
      if (days >= 30) reasons.push(`Vlasnik nije ulazio ${days} dana`);
    }
  }

  const level: HealthLevel = risk || reasons.length >= 3 ? "rizik" : reasons.length > 0 ? "pratiti" : "dobro";
  return { ...c, level, reasons };
}

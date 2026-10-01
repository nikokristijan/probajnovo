import type { Subscription } from "@/lib/db/schema";

export type SubscriptionTone = "ok" | "info" | "warn" | "bad" | "muted";

export type SubscriptionState = {
  label: string;
  tone: SubscriptionTone;
  /** Dana kašnjenja s uplatom (0 ako ne kasni). */
  daysLate: number;
  /** Treba li uz redak ponuditi "Evidentiraj uplatu". */
  needsPayment: boolean;
};

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Stanje pretplate kako ga čovjek treba vidjeti (plan #16), izračunato iz
 * zapisa i današnjeg datuma, ne ručno upisano: "Kasni 12 dana" se samo
 * pojavi kad prođe datum naplate, bez da itko mijenja status.
 */
export function describeSubscription(
  s: Pick<Subscription, "status" | "isTrial" | "trialEndsAt" | "nextRenewalDate">,
  today: string
): SubscriptionState {
  if (s.status === "cancelled") return { label: "Otkazana", tone: "muted", daysLate: 0, needsPayment: false };
  if (s.status === "paused") return { label: "Pauzirana", tone: "muted", daysLate: 0, needsPayment: false };

  if ((s.status === "trial" || s.isTrial) && (!s.trialEndsAt || s.trialEndsAt > today)) {
    if (!s.trialEndsAt) return { label: "Probni period", tone: "info", daysLate: 0, needsPayment: false };
    const left = daysBetween(today, s.trialEndsAt);
    return {
      label: left <= 7 ? `Probni — još ${left} ${left === 1 ? "dan" : "dana"}` : "Probni period",
      tone: "info",
      daysLate: 0,
      needsPayment: false,
    };
  }

  const late = daysBetween(s.nextRenewalDate, today);
  if (late > 0) {
    return {
      label: `Kasni ${late} ${late === 1 ? "dan" : "dana"}`,
      tone: late > 14 ? "bad" : "warn",
      daysLate: late,
      needsPayment: true,
    };
  }
  if (late === 0) return { label: "Naplata danas", tone: "warn", daysLate: 0, needsPayment: true };
  if (-late <= 7) return { label: `Naplata za ${-late} ${-late === 1 ? "dan" : "dana"}`, tone: "warn", daysLate: 0, needsPayment: true };
  return { label: "Aktivna", tone: "ok", daysLate: 0, needsPayment: false };
}

export const TONE_CLASSES: Record<SubscriptionTone, string> = {
  ok: "bg-[#0a7a3e]/10 text-[#0a6b37]",
  info: "bg-[#0000c3]/10 text-[#0000c3]",
  warn: "bg-[#ff7f00]/12 text-[#9a4a00]",
  bad: "bg-[#d70015]/10 text-[#b80012]",
  muted: "bg-black/5 text-black/60",
};

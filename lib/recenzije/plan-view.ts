import type { usage } from "@/lib/recenzije/services/billing";

type Usage = Awaited<ReturnType<typeof usage>>;

const STATUS: Record<string, string> = {
  trialing: "bez naplate",
  active: "aktivno",
  past_due: "kasni plaćanje",
  canceled: "otkazano",
  unpaid: "neplaćeno",
  incomplete: "nedovršeno",
};

export type PlanView = {
  /** Kratka oznaka ispod naziva tvrtke u izborniku. */
  chip: string;
  /** Naslov kartice "Paket i razdoblje". */
  title: string;
  statusLabel: string;
  tone: "green" | "amber" | "neutral";
  /** Što znači `endDate`: "Vrijedi do", "Obnavlja se", "Bez naplate do"... */
  endLabel: string | null;
  endDate: Date | null;
  /** Razdoblje koje je NOVO tim odobrio bez naplate (samo informacija za tim). */
  noCharge: boolean;
};

/**
 * Prikaz stanja paketa za izbornik i stranicu "Paket i razdoblje". Klijent ništa ne bira ni ne plaća
 * u aplikaciji, pa ovo ostaje samo čitljiv status; upravlja se iz NOVO admina.
 */
export function describePlan(u: Usage, isDemo: boolean, now = new Date()): PlanView {
  if (isDemo) {
    return { chip: "Primjer", title: "Primjer", statusLabel: "samo za čitanje", tone: "neutral", endLabel: null, endDate: null, noCharge: false };
  }
  const sub = u.subscription;
  if (!sub) {
    return { chip: "Bez paketa", title: "Bez paketa", statusLabel: "bez pretplate", tone: "amber", endLabel: null, endDate: null, noCharge: false };
  }

  const viaStripe = !!sub.stripeSubscriptionId;
  const trialing = sub.status === "trialing";
  const noCharge = u.active && (u.freePeriod || trialing);
  const manualExpired = sub.status === "active" && !viaStripe && !!sub.currentPeriodEnd && sub.currentPeriodEnd < now;
  const expired = u.trialExpired || manualExpired;

  let endDate: Date | null = null;
  let endLabel: string | null = null;
  if (trialing) {
    endDate = sub.trialEndsAt;
    endLabel = u.trialExpired ? "Isteklo" : "Bez naplate do";
  } else if (sub.currentPeriodEnd) {
    endDate = sub.freePeriodEndsAt && !viaStripe ? sub.freePeriodEndsAt : sub.currentPeriodEnd;
    if (!u.active) endLabel = "Isteklo";
    else if (viaStripe) endLabel = sub.cancelAtPeriodEnd ? "Završava" : "Obnavlja se";
    else endLabel = noCharge ? "Bez naplate do" : "Vrijedi do";
  }

  const planName = u.plan?.name ?? null;
  const title = planName ? `Paket ${planName}` : trialing ? "Razdoblje bez naplate" : "Bez paketa";
  const chip = `${title}${u.active ? (noCharge && planName ? " · bez naplate" : "") : " · neaktivan"}`;
  const statusLabel = expired ? "isteklo" : (STATUS[sub.status] ?? sub.status);

  return { chip, title, statusLabel, tone: u.active ? "green" : "amber", endLabel, endDate, noCharge };
}

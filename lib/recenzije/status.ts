import type { Tone } from "@/components/recenzije/ui/primitives";
import type { MessageStatus, ReviewStatus } from "@/lib/recenzije/db/schema";

export const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: Tone }> = {
  NOT_CONTACTED: { label: "Nije kontaktiran", tone: "neutral" },
  REQUEST_SENT: { label: "Zahtjev poslan", tone: "blue" },
  CLICKED: { label: "Kliknuo link", tone: "violet" },
  FOLLOW_UP_SCHEDULED: { label: "Podsjetnik zakazan", tone: "amber" },
  REVIEW_RECEIVED: { label: "Recenzija primljena", tone: "green" },
  COMPLETED: { label: "Završeno", tone: "green" },
};

export const REVIEW_STATUS_ORDER: ReviewStatus[] = [
  "NOT_CONTACTED",
  "REQUEST_SENT",
  "CLICKED",
  "FOLLOW_UP_SCHEDULED",
  "REVIEW_RECEIVED",
  "COMPLETED",
];

export const MESSAGE_STATUS: Record<MessageStatus, { label: string; tone: Tone }> = {
  QUEUED: { label: "U redu", tone: "neutral" },
  SENT: { label: "Poslano", tone: "blue" },
  DELIVERED: { label: "Isporučeno", tone: "green" },
  FAILED: { label: "Neuspjelo", tone: "red" },
  UNDELIVERED: { label: "Nije isporučeno", tone: "red" },
  RECEIVED: { label: "Primljeno", tone: "violet" },
};

const TZ = "Europe/Zagreb";

export function timeAgo(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  const future = s < 0;
  const a = Math.abs(s);
  const fmt = (n: number, u: string) => (future ? `za ${n} ${u}` : `prije ${n} ${u}`);
  if (a < 60) return future ? "uskoro" : "upravo";
  if (a < 3600) return fmt(Math.floor(a / 60), "min");
  if (a < 86400) return fmt(Math.floor(a / 3600), "h");
  if (a < 86400 * 30) {
    const n = Math.floor(a / 86400);
    return fmt(n, n === 1 ? "dan" : "dana");
  }
  return formatDate(date);
}

export function formatDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleString("hr-HR", {
    day: "numeric",
    month: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: TZ,
  });
}

export function formatEur(cents: number) {
  return new Intl.NumberFormat("hr-HR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

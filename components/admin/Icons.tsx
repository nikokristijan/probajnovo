/**
 * Malen, ručno pisan set SVG ikona — NAMJERNO bez vanjske ikonske
 * biblioteke (izbjegava dirati package.json/package-lock.json). Sve ikone
 * dijele isti jezik: 20x20 viewBox, stroke (ne fill), širina crte 1.75,
 * zaobljeni krajevi — "jedan set ikona, ista debljina crte, posvuda"
 * (na izričit zahtjev — RANIJE je npr. hamburger izbornik bio "☰" znak,
 * ne prava ikona, što na svakoj platformi/fontu izgleda drugačije).
 */
type IconProps = { className?: string; size?: number };

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function MenuIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3 5.5h14M3 10h14M3 14.5h14" />
    </svg>
  );
}

export function LogOutIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M7.5 17H4.75A1.75 1.75 0 0 1 3 15.25V4.75A1.75 1.75 0 0 1 4.75 3H7.5" />
      <path d="M13 14l4-4-4-4" />
      <path d="M17 10H7.5" />
    </svg>
  );
}

export function ExternalLinkIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M8.5 3.5H16.5V11.5" />
      <path d="M16.5 3.5L8 12" />
      <path d="M13.5 10.5V15.25A1.25 1.25 0 0 1 12.25 16.5H4.75A1.25 1.25 0 0 1 3.5 15.25V7.75A1.25 1.25 0 0 1 4.75 6.5H9.5" />
    </svg>
  );
}

/** Prazno stanje popisa (vikendice/firme/proizvodi/upiti...) — vidi .neu-empty. */
export function InboxIcon({ className, size = 26 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3 11l2.4-6.2A1.5 1.5 0 0 1 6.8 4h6.4a1.5 1.5 0 0 1 1.4.8L17 11" />
      <path d="M3 11v4.25A1.75 1.75 0 0 0 4.75 17h10.5A1.75 1.75 0 0 0 17 15.25V11" />
      <path d="M3 11h4.2c.3 0 .55.18.65.46.34.94 1.24 1.54 2.15 1.54s1.81-.6 2.15-1.54c.1-.28.35-.46.65-.46H17" />
    </svg>
  );
}

/** Greška (npr. neuspjeli fetch) — dosljedno crveno = upozorenje/greška. */
export function AlertIcon({ className, size = 22 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M10 3.2 17.3 15.5a1 1 0 0 1-.86 1.5H3.56a1 1 0 0 1-.86-1.5L10 3.2Z" />
      <path d="M10 8.3v3.3" />
      <path d="M10 14.2h.01" />
    </svg>
  );
}

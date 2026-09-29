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

/** "+" za akcije dodavanja (npr. novi zadatak) — FAZA 2 tim/zadaci/poruke. */
export function PlusIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M10 3.5v13M3.5 10h13" />
    </svg>
  );
}

/** Zadaci (app/admin/zadaci) — kvačica u okviru, dosljedno s "gotovo" stanjem
    zadatka (status="done" koristi istu kvačicu, vidi TeamTaskCard). */
export function ChecklistIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="13" height="13" rx="3" />
      <path d="M7 10.2l2 2 4-4.4" />
    </svg>
  );
}

/** Poruke/tim feed (app/admin/poruke). */
export function ChatIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3.5 5.75A1.75 1.75 0 0 1 5.25 4h9.5A1.75 1.75 0 0 1 16.5 5.75v6a1.75 1.75 0 0 1-1.75 1.75H9l-3.6 2.9a.5.5 0 0 1-.81-.39v-2.51H5.25A1.75 1.75 0 0 1 3.5 11.75v-6Z" />
    </svg>
  );
}

/* --- "Ured" prisutnost (app/admin/poruke, OfficePresence.tsx) — status
   bedž po pikseliziranom avataru: monitor=radi, šalica=jede, mjesec=spava. */

export function MonitorIcon({ className, size = 12 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3" y="4" width="14" height="9.5" rx="1.5" />
      <path d="M7.5 17h5M10 13.5V17" />
    </svg>
  );
}

export function CupIcon({ className, size = 12 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M4.5 5.5h9v6.5a4.5 4.5 0 0 1-4.5 4.5v0a4.5 4.5 0 0 1-4.5-4.5V5.5Z" />
      <path d="M13.5 7h1.25a2 2 0 0 1 0 4H13.5" />
      <path d="M6.5 3v1.2M10 3v1.2" />
    </svg>
  );
}

export function MoonIcon({ className, size = 12 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M16.5 12.3A7 7 0 1 1 8.2 3.6a5.5 5.5 0 0 0 8.3 8.7Z" />
    </svg>
  );
}

/* --- Redizajn vlasničkog/adminskog izbornika (app/admin/rezervacije) — na
   izričit zahtjev "vlasnik menu izgleda jako nepregledno": raniji stupac od
   5 owner-quicklink/admin-quicklink pilula (Izvezi CSV/Godišnji izvještaj/
   Backup/Knjigovođa CSV/PDF) slaganih jedna preko druge sad je skriven iza
   jednog neu-disclosure elementa, vidi .neu-disclosure u globals.css. */

/** "Izvoz i izvještaji" — glava disclosure sažetka. */
export function DownloadIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M10 3v9.5M6.2 9.3 10 13l3.8-3.7" />
      <path d="M4 15.5v.75A1.75 1.75 0 0 0 5.75 18h8.5A1.75 1.75 0 0 0 16 16.25v-.75" />
    </svg>
  );
}

/** Strelica koja se rotira 180° kad je <details> otvoren (vidi
    .neu-disclosure[open] u globals.css) — jedini vizualni signal
    otvoreno/zatvoreno, bez JS-a. */
export function ChevronDownIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M4.5 7.5 10 13l5.5-5.5" />
    </svg>
  );
}

/* --- Portal (Faza 3) — spojeni Zadaci+Poruke+DM+profil+statistika tab,
   vidi app/admin/portal. Isti stroke-jezik kao gornje ikone. --- */

/** Glavni nav link "Portal" u headeru (app/admin/layout.tsx) — mreža/pločice,
    dosljedno "sve na jednom mjestu" konceptu spojenog taba. */
export function PortalIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" />
    </svg>
  );
}

/** Pošalji poruku — gumb u dnu chat niti (TeamChannelThread/DirectMessageThread). */
export function SendIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M17 3 3 9.2l6 2.2M17 3l-5.7 14-2.3-6.6M17 3 8.3 11.4" />
    </svg>
  );
}

/** Profil admina (Portal sidebar + /admin/portal/profil/[email]). */
export function UserIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="10" cy="6.8" r="3.3" />
      <path d="M3.8 17c.6-3.4 3.3-5.5 6.2-5.5s5.6 2.1 6.2 5.5" />
    </svg>
  );
}

/** Statistika/grafovi sekcija u Portalu. */
export function ChartIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3.5 16.5h13" />
      <rect x="5" y="10.5" width="3" height="6" rx="1" />
      <rect x="9.5" y="6.5" width="3" height="10" rx="1" />
      <rect x="14" y="3" width="3" height="13.5" rx="1" />
    </svg>
  );
}

/** "#" kanal (Tim poruke) u Portal sidebaru — Slack/Teams jezik. */
export function HashIcon({ className, size = 15 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M7.5 3 5.5 17M14.5 3l-2 14M3.5 7.5h13M2.5 12.5h13" />
    </svg>
  );
}

/** Prikvači/otkvači poruku (Portal Faza 5, TeamChannelThread.tsx) — obrnuta
    pribadača, isti Slack/Teams jezik kao HashIcon iznad. */
export function PinIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M8 3.5h4l.6 5 2.4 2v1.5H5v-1.5l2.4-2 .6-5Z" />
      <path d="M10 12v4.5" />
    </svg>
  );
}

/** "Dodaj reakciju" gumb ispod poruke (Portal Faza 5) — smajlić s malim
    plusom, isti jezik kao ostale ikone (stroke, ne fill). */
export function SmilePlusIcon({ className, size = 15 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="8.2" cy="10.5" r="6" />
      <path d="M6 9.5h.01M10.4 9.5h.01M5.8 12c.6 1 1.5 1.6 2.4 1.6s1.8-.6 2.4-1.6" />
      <path d="M15.5 3v4.5M13.25 5.25h4.5" />
    </svg>
  );
}

/* --- Redizajn vlasničkog izbornika (Task #14, "full-width grid,
   mobile+desktop") — app/admin/layout.tsx zamjenjuje raniji tekstualni red
   pilula za role="owner" mrežom od 5 pločica (Početna/Upiti/Rezervacije/
   Kalendar/Postavke), svaka s vlastitom ikonom iznad labele umjesto samog
   teksta, vidi .owner-menu-tile u globals.css. Upiti dijeli InboxIcon iznad
   (semantički isti pojam — upit = poruka u "sandučiću"). */

/** Početna (owner dashboard). */
export function HomeIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3.3 9.6 10 4.2l6.7 5.4" />
      <path d="M5.3 8.3V15.5a1.2 1.2 0 0 0 1.2 1.2h7a1.2 1.2 0 0 0 1.2-1.2V8.3" />
      <path d="M8.1 16.7v-4.4h3.8v4.4" />
    </svg>
  );
}

/** Rezervacije (vikendica/soba) — krevet, umjesto generičke kvačice. */
export function BedIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3 16.5V6.5" />
      <path d="M3 13h14v3.5" />
      <rect x="3.6" y="9.3" width="4.6" height="3.7" rx="1" />
      <path d="M8.2 13v-2a1.6 1.6 0 0 1 1.6-1.6h4.6A1.6 1.6 0 0 1 16 11v2" />
    </svg>
  );
}

/** Kalendar (owner nav) — mjesečni prikaz s par označenih dana. */
export function CalendarIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3.3" y="4.5" width="13.4" height="12" rx="2" />
      <path d="M3.3 8.3h13.4" />
      <path d="M7 3v3M13 3v3" />
      <path d="M6.6 11.5h.01M10 11.5h.01M13.4 11.5h.01M6.6 14.3h.01M10 14.3h.01" />
    </svg>
  );
}

/** Postavke (owner nav) — zupčanik, dosljedno tanka linija kao ostatak seta. */
export function SettingsIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 3.5v2.1M10 14.4v2.1M16.5 10h-2.1M5.6 10H3.5" />
      <path d="M14.6 5.4 13.1 6.9M6.9 13.1l-1.5 1.5M14.6 14.6l-1.5-1.5M6.9 6.9 5.4 5.4" />
    </svg>
  );
}

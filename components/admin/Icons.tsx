/**
 * Set SVG ikona admin panela.
 *
 * PETI KRUG (korisnički feedback: "ikonice nisu savršene") — ranije ručno
 * crtane putanje (20x20 grid, nagađane koordinate lukova) zamijenjene su
 * TOČNIM putanjama iz Lucide seta (https://github.com/lucide-icons/lucide,
 * ISC licenca, lucide-static@1.49.0) — profesionalno dizajniran set na
 * 24x24 gridu s optički usklađenim debljinama, kutovima i centriranjem.
 * I dalje NAMJERNO bez npm ovisnosti: kopirane su samo putanje za ikone
 * koje admin stvarno koristi, pa package.json/package-lock.json ostaju
 * netaknuti. Nazivi exporta, zadane veličine i props su isti kao prije,
 * tako da nijedan pozivatelj ne treba mijenjati.
 *
 * Iznimka: MonitorIcon/CupIcon/MoonIcon (statusni bedževi unutar "Ured"
 * pixel-art scene, OfficePresence.tsx) ostaju na starom 20x20 crtežu —
 * Ured se namjerno ne dira.
 */
type IconProps = { className?: string; size?: number };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Stari 20x20 jezik — samo za Ured bedževe (vidi komentar gore). */
const base20 = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Hamburger izbornik (lucide: menu). */
export function MenuIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </svg>
  );
}

/** Odjava (lucide: log-out). */
export function LogOutIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

/** Vanjska poveznica, npr. "Pogledaj stranicu" (lucide: external-link). */
export function ExternalLinkIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

/** Upiti / prazno stanje popisa, vidi .neu-empty (lucide: inbox). */
export function InboxIcon({ className, size = 26 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

/** Greška, npr. neuspjeli fetch (lucide: triangle-alert). */
export function AlertIcon({ className, size = 22 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/** "+" za akcije dodavanja (lucide: plus). */
export function PlusIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/** Zadaci — kvačica u okviru (lucide: square-check). */
export function ChecklistIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m16 9-5.5 5.5L8 12" />
    </svg>
  );
}

/** Poruke / tim feed (lucide: message-square). */
export function ChatIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/* --- "Ured" prisutnost (OfficePresence.tsx) — status bedž po
   pikseliziranom avataru: monitor=radi, šalica=jede, mjesec=spava.
   NETAKNUTO (vidi komentar na vrhu datoteke). */

export function MonitorIcon({ className, size = 12 }: IconProps) {
  return (
    <svg {...base20} width={size} height={size} className={className} aria-hidden="true">
      <rect x="3" y="4" width="14" height="9.5" rx="1.5" />
      <path d="M7.5 17h5M10 13.5V17" />
    </svg>
  );
}

export function CupIcon({ className, size = 12 }: IconProps) {
  return (
    <svg {...base20} width={size} height={size} className={className} aria-hidden="true">
      <path d="M4.5 5.5h9v6.5a4.5 4.5 0 0 1-4.5 4.5v0a4.5 4.5 0 0 1-4.5-4.5V5.5Z" />
      <path d="M13.5 7h1.25a2 2 0 0 1 0 4H13.5" />
      <path d="M6.5 3v1.2M10 3v1.2" />
    </svg>
  );
}

export function MoonIcon({ className, size = 12 }: IconProps) {
  return (
    <svg {...base20} width={size} height={size} className={className} aria-hidden="true">
      <path d="M16.5 12.3A7 7 0 1 1 8.2 3.6a5.5 5.5 0 0 0 8.3 8.7Z" />
    </svg>
  );
}

/** "Izvoz i izvještaji" — glava disclosure sažetka (lucide: download). */
export function DownloadIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

/** Strelica koja se rotira 180° kad je <details> otvoren, vidi
    .neu-disclosure[open] (lucide: chevron-down). */
export function ChevronDownIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Portal — naslov i nav (lucide: layout-grid). */
export function PortalIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

/** Pošalji poruku — gumb u dnu chat niti (lucide: send). */
export function SendIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z" />
      <path d="m21.854 2.147-10.94 10.939" />
    </svg>
  );
}

/** Profil admina (lucide: user). */
export function UserIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** Statistika / grafovi (lucide: chart-column). */
export function ChartIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </svg>
  );
}

/** "#" kanal (lucide: hash). */
export function HashIcon({ className, size = 15 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  );
}

/** Prikvači/otkvači poruku (lucide: pin). */
export function PinIcon({ className, size = 14 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

/** "Dodaj reakciju" ispod poruke (lucide: smile-plus). */
export function SmilePlusIcon({ className, size = 15 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M13.267 2.08a10 10 0 1 0 8.653 8.653" />
      <path d="M15 10V9" />
      <path d="M16 5h6" />
      <path d="M16.472 15a6 6 0 0 1-8.943 0" />
      <path d="M19 2v6" />
      <path d="M9 10V9" />
    </svg>
  );
}

/* --- Vlasnički izbornik (Početna/Upiti/Rezervacije/Kalendar/Postavke),
   vidi .owner-menu-tile u globals.css. Upiti dijeli InboxIcon iznad. */

/** Početna (lucide: house). */
export function HomeIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

/** Rezervacije (lucide: bed). */
export function BedIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </svg>
  );
}

/** Kalendar (lucide: calendar-days). */
export function CalendarIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M8 2v3" />
      <path d="M16 2v3" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 13h.01" />
      <path d="M12 13h.01" />
      <path d="M16 13h.01" />
      <path d="M8 17h.01" />
      <path d="M12 17h.01" />
      <path d="M16 17h.01" />
    </svg>
  );
}

/** Postavke (lucide: settings). */
export function SettingsIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Pretraga (lucide: search). */
export function SearchIcon({ className, size = 18 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </svg>
  );
}

/** Aktivnost (lucide: activity). */
export function ActivityIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}

/** Rođendani (lucide: cake). */
export function GiftIcon({ className, size = 20 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8" />
      <path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1" />
      <path d="M2 21h20" />
      <path d="M7 8v3" />
      <path d="M12 8v3" />
      <path d="M17 8v3" />
      <path d="M7 4h.01" />
      <path d="M12 4h.01" />
      <path d="M17 4h.01" />
    </svg>
  );
}

/* --- Izbor teme (OwnerThemeToggle, plan #52) — umjesto emojija ☀️🖥️🌙.
   Odvojeno od "Ured" ikona gore da se one ne diraju. */

/** lucide: sun */
export function ThemeSunIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2m-7.07-2.93 1.41-1.41m11.32-11.32 1.41-1.41M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41" />
    </svg>
  );
}

/** lucide: monitor */
export function ThemeSystemIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

/** lucide: moon */
export function ThemeMoonIcon({ className, size = 16 }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className} aria-hidden="true">
      <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
    </svg>
  );
}

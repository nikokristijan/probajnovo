import { TRANS_LANGS, type TransLang } from "@/lib/recenzije/menu-lang";

/**
 * Višejezični tekst: kad postoji drukčiji prijevod, ispisuju se hrvatski i svi prijevodi u zasebnim elementima, a CSS
 * (.jl-menu[data-lang] .jl-hr / .jl-en / .jl-de / .jl-it) prikazuje samo onaj za odabrani jezik. Tako prebacivanje jezika ne traži novi
 * zahtjev ni ponovno crtanje, a stranica bez JavaScripta ostaje na hrvatskom. Hrvatski element je vidljiv i za svaki jezik za koji
 * prijevod ovog teksta nedostaje (pojedinačni povratak na hrvatski), a nosi lang="hr" da čitači i prevoditelji znaju što je što.
 * Tekst se ispisuje kao obični React tekst (escapeano), nikad kao HTML.
 */
export function Bi({ hr, en, de, it }: { hr: string; en?: string | null; de?: string | null; it?: string | null }) {
  const given: Record<TransLang, string | null | undefined> = { en, de, it };
  const have = TRANS_LANGS.map((l) => [l, given[l]?.trim() ?? ""] as const).filter(([, v]) => v && v !== hr);
  if (have.length === 0) return <>{hr}</>;
  const translated = new Set<TransLang>(have.map(([l]) => l));
  // jl-fb-<jezik>: hrvatski tekst ostaje vidljiv i na jeziku za koji prijevod ovog teksta nedostaje (pravilo u jelovnik.css).
  const fallback = TRANS_LANGS.filter((l) => !translated.has(l)).map((l) => `jl-fb-${l}`);
  return (
    <>
      <span className={["jl-hr", ...fallback].join(" ")} lang="hr">
        {hr}
      </span>
      {have.map(([l, v]) => (
        <span key={l} className={`jl-${l}`} lang={l}>
          {v}
        </span>
      ))}
    </>
  );
}

/** Natpisi sučelja gosta (ne sadržaj jelovnika) na svim jezicima. */
export const UI = {
  allergens: { hr: "Alergeni", en: "Allergens", de: "Allergene", it: "Allergeni" },
  unavailable: { hr: "Trenutno nedostupno", en: "Currently unavailable", de: "Derzeit nicht verfügbar", it: "Al momento non disponibile" },
  rate: { hr: "Ocijeni nas", en: "Rate us", de: "Bewerten Sie uns", it: "Valutateci" },
  contact: { hr: "Kontakt", en: "Contact", de: "Kontakt", it: "Contatti" },
  call: { hr: "Nazovi", en: "Call", de: "Anrufen", it: "Chiama" },
  email: { hr: "Pošalji e-mail", en: "Email", de: "E-Mail senden", it: "Invia e-mail" },
  map: { hr: "Karta", en: "Map", de: "Karte", it: "Mappa" },
  network: { hr: "Mreža", en: "Network", de: "Netzwerk", it: "Rete" },
  password: { hr: "Lozinka", en: "Password", de: "Passwort", it: "Password" },
  copy: { hr: "Kopiraj", en: "Copy", de: "Kopieren", it: "Copia" },
  copied: { hr: "Kopirano", en: "Copied", de: "Kopiert", it: "Copiato" },
  selected: { hr: "Označeno", en: "Selected", de: "Markiert", it: "Selezionato" },
  selectedManual: { hr: "Označeno, kopirajte ručno", en: "Selected, copy manually", de: "Markiert, bitte manuell kopieren", it: "Selezionato, copia manualmente" },
  preparing: { en: "The menu is being prepared. Please ask our staff.", de: "Die Speisekarte wird gerade vorbereitet. Bitte fragen Sie unser Personal.", it: "Il menu è in preparazione. Chieda pure al nostro personale." },
} as const;

/** Prikaz natpisa iz UI rječnika (ili bilo kojeg objekta s hr/en/de/it). */
export function T({ t }: { t: { hr: string; en: string; de: string; it: string } }) {
  return <Bi hr={t.hr} en={t.en} de={t.de} it={t.it} />;
}

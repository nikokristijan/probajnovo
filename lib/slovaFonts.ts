/**
 * Popis fontova dostupnih u /slova konfiguratoru (custom prostorna slova).
 * Svaki `cssVar` mora odgovarati varijabli koju `next/font/google` postavlja
 * u app/slova/page.tsx (osim "spacegrotesk", koji je već globalno učitan u
 * app/layout.tsx za cijeli sajt). Ova lista je jedini izvor istine za
 * redoslijed/nazive u UI-u — komponenta (components/slova/SlovaCustomizer)
 * samo referencira cssVar preko inline style-a, ne uvozi fontove sama.
 */
export type SlovaFont = {
  id: string;
  /** Naziv prikazan korisniku u gridu fontova. */
  label: string;
  /** CSS custom property koju postavlja next/font (var(--font-slova-...)). */
  cssVar: string;
  /** Kratki opis "vibe-a" fonta, prikazan ispod naziva. */
  vibe: string;
};

export const SLOVA_FONTS: SlovaFont[] = [
  { id: "anton", label: "Anton", cssVar: "--font-slova-anton", vibe: "snažno, plakatno" },
  { id: "bebas", label: "Bebas Neue", cssVar: "--font-slova-bebas", vibe: "visoko, izduženo" },
  { id: "archivo", label: "Archivo Black", cssVar: "--font-slova-archivo", vibe: "debelo, geometrijsko" },
  { id: "montserrat", label: "Montserrat", cssVar: "--font-slova-montserrat", vibe: "moderno, čisto" },
  { id: "poppins", label: "Poppins", cssVar: "--font-slova-poppins", vibe: "zaobljeno, prijateljsko" },
  { id: "oswald", label: "Oswald", cssVar: "--font-slova-oswald", vibe: "usko, klasika za natpise" },
  { id: "orbitron", label: "Orbitron", cssVar: "--font-slova-orbitron", vibe: "futurističko, tehno" },
  { id: "playfair", label: "Playfair Display", cssVar: "--font-slova-playfair", vibe: "elegantno, serif" },
  { id: "pacifico", label: "Pacifico", cssVar: "--font-slova-pacifico", vibe: "rukopisno, ležerno" },
  { id: "spacegrotesk", label: "Space Grotesk", cssVar: "--font-space-grotesk", vibe: "NOVO stil, grotesque" },
  { id: "righteous", label: "Righteous", cssVar: "--font-slova-righteous", vibe: "retro, izloženo" },
];

export type SlovaSize = {
  id: string;
  label: string;
  range: string;
  pricePerLetter: number;
  previewRem: number;
};

export const SLOVA_SIZES: SlovaSize[] = [
  { id: "s", label: "Mala", range: "do 10 cm visine", pricePerLetter: 4, previewRem: 2.1 },
  { id: "m", label: "Srednja", range: "10–20 cm visine", pricePerLetter: 7, previewRem: 3.2 },
  { id: "l", label: "Velika", range: "20–35 cm visine", pricePerLetter: 12, previewRem: 4.6 },
];

export type SlovaColor = { id: string; label: string; hex: string };

export const SLOVA_COLORS: SlovaColor[] = [
  { id: "white", label: "Bijela", hex: "#f4f4f1" },
  { id: "black", label: "Crna", hex: "#131316" },
  { id: "orange", label: "Narančasta", hex: "#ff7f00" },
  { id: "grey", label: "Betonsko siva", hex: "#9a9aa4" },
  { id: "gold", label: "Zlatna", hex: "#cda449" },
  { id: "wood", label: "Drvo efekt", hex: "#a9773f" },
];

/**
 * Podloga na kojoj se pregledava tekst u konfiguratoru — namjerno obične
 * ravne boje/uzorci (swatch), ne lažne "fotografije prostora": drži se
 * NOVO-ove sirove, tipografski vođene estetike (vidi app/slova/slova.css)
 * umjesto generičkih AI stock-photo pozadina.
 */
export type SlovaBackdrop = { id: string; label: string; swatch: string };

export const SLOVA_BACKDROPS: SlovaBackdrop[] = [
  { id: "white", label: "Bijela", swatch: "#ffffff" },
  { id: "black", label: "Crna", swatch: "#0a0a1a" },
  { id: "concrete", label: "Beton", swatch: "#c7c7cf" },
  { id: "raster", label: "Raster", swatch: "#ffffff" },
];

export const SLOVA_MIN_ORDER_EUR = 15;

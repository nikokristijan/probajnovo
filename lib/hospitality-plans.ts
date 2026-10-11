/**
 * Paketi i cijene digitalnog jelovnika za kafiće i restorane (stranica /digitalni-jelovnik).
 *
 * VAŽNO: cijene su PRIJEDLOG (čekaju odobrenje vlasnika) i mijenjaju se samo ovdje.
 * Stranica, JSON-LD i padajući izbornik u obrascu za upit čitaju isključivo ovu datoteku,
 * pa promjena iznosa ili popisa stavki ne traži izmjene nigdje drugdje.
 *
 * Pravila: iznosi su u EUR, mjesečno, BEZ PDV-a. Godišnja uplata = 10 mjesečnih iznosa
 * (dva mjeseca gratis). Postavljanje je jednokratno i besplatno je uz godišnju uplatu (do uključenog broja komada).
 * Struktura: tri paketa (Jelovnik, Jelovnik + Recenzije, Sve uključeno) i dodaci uz Jelovnik koji se mogu uzeti zasebno;
 * ušteda paketa "Sve uključeno" računa se iz ovih iznosa (bundleSavingEur), ne upisuje se ručno.
 * Ovo je odvojeno od paketa NOVO Recenzije (lib/recenzije), koji služe obrtima i tvrtkama bez jelovnika.
 */

/**
 * Fizički komplet koji ide uz svaki paket i jednokratno postavljanje. Jedinica je KOMAD: 1 komad = jedan stolni stalak s
 * QR kodom + jedna NFC pločica (gost prisloni mobitel ili skenira kod, oba otvaraju isti jelovnik). Komadi se broje, a ne
 * stolovi, jer stol s osam mjesta može trebati komad po gostu. Svi iznosi i brojevi su ovdje; stranica i tekstovi ih računaju.
 * Iznosi su u EUR bez PDV-a.
 */
export const HOSPITALITY_SETUP = {
  /** Jednokratno postavljanje. Uključuje `includedPieces` komada, unos jelovnika s fotografije, ispis i podešavanje. */
  setupFeeEur: 99,
  /** Koliko komada (stalak s QR kodom + NFC pločica) je uključeno u postavljanje. */
  includedPieces: 10,
  /** Cijena svakog dodatnog komada uz mjesečno plaćanje. */
  extraPieceEur: 8,
  /** Cijena svakog dodatnog komada uz godišnju uplatu (postavljanje je tada besplatno do `includedPieces`). */
  extraPieceAnnualEur: 5,
  /** Poštarina za dostavu izvan Slavonskog Broda i okolice (kad nema postavljanja na licu mjesta). */
  shippingEur: 10,
} as const;

export const KIT_SHORT = "Stolni stalci s QR kodom i NFC pločica";

/** "1 komad", "2 komada", "10 komada": hrvatski oblik uz broj. */
export function piecesLabel(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  return `${n} ${m10 === 1 && m100 !== 11 ? "komad" : "komada"}`;
}

/** Koliko dodatnih komada preko uključenih (nikad negativno). */
export function extraPieces(totalPieces: number): number {
  return Math.max(0, Math.floor(totalPieces) - HOSPITALITY_SETUP.includedPieces);
}

/** Dodatni komadi preko uključenih: iznos u EUR (mjesečno plaćanje ili godišnja uplata). */
export function extraPiecesCostEur(totalPieces: number, annual: boolean): number {
  const per = annual ? HOSPITALITY_SETUP.extraPieceAnnualEur : HOSPITALITY_SETUP.extraPieceEur;
  return extraPieces(totalPieces) * per;
}

/** Jedna rečenica o komplementu, za stranicu (računa se iz HOSPITALITY_SETUP). */
export const KIT_NOTE = `1 komad je jedan stolni stalak s QR kodom i jedna NFC pločica. U postavljanje je uključeno do ${HOSPITALITY_SETUP.includedPieces} komada, a svaki dodatni komad je ${HOSPITALITY_SETUP.extraPieceEur} € (uz godišnju uplatu ${HOSPITALITY_SETUP.extraPieceAnnualEur} €).`;

export type HospitalityPlanKey = "jelovnik" | "jelovnik-recenzije" | "sve";

export type HospitalityPlan = {
  key: HospitalityPlanKey;
  name: string;
  /** Mjesečna cijena u EUR, bez PDV-a. */
  priceMonthlyEur: number;
  /** Kratka oznaka iznad naziva (npr. "Najpopularniji"), ili null. */
  badge: string | null;
  /** Vizualno najjača kartica (paket s najboljom vrijednošću). */
  highlight: boolean;
  /** Jedna rečenica koja kaže za koga je paket. */
  summary: string;
  /** Što paket uključuje, redom. */
  features: string[];
  /** Najviše SMS poruka mjesečno uključeno u paket; 0 = paket ne šalje poruke gostima. */
  smsMonthly: number;
};

export const HOSPITALITY_PLANS: HospitalityPlan[] = [
  {
    key: "jelovnik",
    name: "Jelovnik",
    priceMonthlyEur: 25,
    badge: null,
    highlight: false,
    summary: "Digitalni jelovnik na NFC pločici i QR kodu. Gosti ga odmah vide, bez unosa broja i bez poruka.",
    smsMonthly: 0,
    features: [
      "Digitalni jelovnik: gost prisloni mobitel na NFC pločicu ili skenira QR kod",
      `${KIT_SHORT} (do ${piecesLabel(HOSPITALITY_SETUP.includedPieces)} u postavljanju) i naljepnica za vrata`,
      "Unos jelovnika i izmjene cijena i stavki radimo mi",
      "Engleski prijevod osnovnog teksta",
      "Tipke Wi-Fi, Kontakt i Ocijeni nas kad ih želite",
      "Gosti odmah vide jelovnik, bez unosa broja i bez poruka",
    ],
  },
  {
    key: "jelovnik-recenzije",
    name: "Jelovnik + Recenzije",
    priceMonthlyEur: 45,
    badge: "Najpopularniji",
    highlight: false,
    summary: "Jelovnik i jedna poruka gostu s molbom za Google recenziju, uz njegovu privolu.",
    smsMonthly: 200,
    features: [
      "Sve iz paketa Jelovnik, uključujući stolne stalke s QR kodom i NFC pločicu",
      "Upis broja gosta uz privolu",
      "Jedna poruka za Google recenziju nakon posjeta (do 200 SMS-ova mjesečno)",
    ],
  },
  {
    key: "sve",
    name: "Sve uključeno",
    priceMonthlyEur: 79,
    badge: "Najbolja vrijednost",
    highlight: true,
    summary: "Sve iz prethodna dva paketa i još sve ostalo, jedna cijena.",
    smsMonthly: 500,
    features: [
      "Sve iz paketa Jelovnik i Jelovnik + Recenzije, uključujući stolne stalke s QR kodom i NFC pločicu",
      "Povremene obavijesti gostima koji su pristali (novosti, događanja, ponude)",
      "Tjedni izvještaj e-mailom sa sažetkom u jednoj rečenici i statistika po stolu (iz gostiju koji ostave broj)",
      "Upozorenje e-mailom na novu lošu Google recenziju (ocjena 3 ili manje), s prijedlogom odgovora",
      "Prijevodi na njemački i talijanski",
      "Do 500 SMS-ova mjesečno",
      "Prioritetna podrška",
    ],
  },
];

export type HospitalityAddon = {
  key: "recenzije" | "obavijesti" | "izvjestaj" | "prijevodi";
  name: string;
  /** Mjesečna cijena dodatka uz paket Jelovnik, EUR bez PDV-a. */
  priceMonthlyEur: number;
  note: string;
};

/** Dodaci uz paket Jelovnik, za one koji žele samo dio. Zbroj svih dodataka + Jelovnik = "sve pojedinačno". */
export const HOSPITALITY_ADDONS: HospitalityAddon[] = [
  { key: "recenzije", name: "Recenzije", priceMonthlyEur: 25, note: "Upis broja uz privolu i poruka za Google recenziju, do 200 SMS-ova mjesečno" },
  { key: "obavijesti", name: "Obavijesti gostima", priceMonthlyEur: 20, note: "Novosti, događanja i ponude, samo gostima koji su pristali (uz Recenzije)" },
  { key: "izvjestaj", name: "Izvještaj i statistika", priceMonthlyEur: 12, note: "Tjedni izvještaj e-mailom sa sažetkom u jednoj rečenici, statistika po stolu i upozorenje na lošu Google recenziju" },
  { key: "prijevodi", name: "Prijevodi DE i IT", priceMonthlyEur: 12, note: "Njemački i talijanski prijevod jelovnika" },
];

/** Paket koji uključuje sve (mora postojati u HOSPITALITY_PLANS). */
export const FULL_PLAN_KEY: HospitalityPlanKey = "sve";
export const BASE_PLAN_KEY: HospitalityPlanKey = "jelovnik";

/** Jednokratno postavljanje, EUR bez PDV-a (vidi HOSPITALITY_SETUP). Besplatno uz godišnju uplatu, do uključenog broja komada. */
export const SETUP_FEE_EUR = HOSPITALITY_SETUP.setupFeeEur;

/** Broj plaćenih mjeseci kod godišnje uplate (umjesto 12). */
export const ANNUAL_PAID_MONTHS = 10;
/** Koliko je mjeseci gratis kod godišnje uplate. */
export const ANNUAL_FREE_MONTHS = 12 - ANNUAL_PAID_MONTHS;

/** Godišnja cijena: 10 mjesečnih iznosa. */
export function annualPriceEur(monthlyEur: number): number {
  return monthlyEur * ANNUAL_PAID_MONTHS;
}

/** Mjesečni zbroj paketa Jelovnik i svih dodataka kupljenih pojedinačno. */
export function everythingSeparatelyEur(): number {
  const base = HOSPITALITY_PLANS.find((p) => p.key === BASE_PLAN_KEY)?.priceMonthlyEur ?? 0;
  return base + HOSPITALITY_ADDONS.reduce((sum, a) => sum + a.priceMonthlyEur, 0);
}

/** Mjesečna ušteda paketa "Sve uključeno" u odnosu na pojedinačne dodatke (nikad negativna). */
export function bundleSavingEur(): number {
  const full = HOSPITALITY_PLANS.find((p) => p.key === FULL_PLAN_KEY)?.priceMonthlyEur ?? 0;
  return Math.max(0, everythingSeparatelyEur() - full);
}

/** "25 €" (hrvatski zapis, bez decimala kad su iznosi cijeli). */
export function formatEur(amountEur: number): string {
  const whole = Number.isInteger(amountEur);
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountEur);
}

export function findHospitalityPlan(key: string | undefined | null): HospitalityPlan | undefined {
  return HOSPITALITY_PLANS.find((p) => p.key === key);
}

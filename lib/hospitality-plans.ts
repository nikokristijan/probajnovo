/**
 * Paketi i cijene digitalnog jelovnika za kafiće i restorane (stranica /digitalni-jelovnik).
 *
 * VAŽNO: cijene su PRIJEDLOG (čekaju odobrenje vlasnika) i mijenjaju se samo ovdje.
 * Stranica, JSON-LD i padajući izbornik u obrascu za upit čitaju isključivo ovu datoteku,
 * pa promjena iznosa ili popisa stavki ne traži izmjene nigdje drugdje.
 *
 * Pravila: iznosi su u EUR, mjesečno, BEZ PDV-a. Godišnja uplata = 10 mjesečnih iznosa
 * (dva mjeseca gratis). Postavljanje je jednokratno i besplatno je uz godišnju uplatu.
 * Struktura: tri paketa (Jelovnik, Jelovnik + Recenzije, Sve uključeno) i dodaci uz Jelovnik koji se mogu uzeti zasebno;
 * ušteda paketa "Sve uključeno" računa se iz ovih iznosa (bundleSavingEur), ne upisuje se ručno.
 * Ovo je odvojeno od paketa NOVO Recenzije (lib/recenzije), koji služe obrtima i tvrtkama bez jelovnika.
 */

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
    summary: "Digitalni jelovnik na QR kodu. Gosti ga odmah vide, bez unosa broja i bez poruka.",
    smsMonthly: 0,
    features: [
      "Digitalni jelovnik na QR kodu",
      "Unos jelovnika i izmjene cijena i stavki radimo mi",
      "Engleski prijevod osnovnog teksta",
      "Jedan komplet stolnih stalaka i naljepnica za vrata",
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
      "Sve iz paketa Jelovnik",
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
      "Sve iz paketa Jelovnik i Jelovnik + Recenzije",
      "Povremene obavijesti gostima koji su pristali (novosti, događanja, ponude)",
      "Tjedni izvještaj jednom rečenicom i statistika po stolu",
      "Upozorenje na lošu recenziju",
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
  { key: "izvjestaj", name: "Izvještaj i statistika", priceMonthlyEur: 12, note: "Tjedni izvještaj jednom rečenicom, statistika po stolu i upozorenje na lošu recenziju" },
  { key: "prijevodi", name: "Prijevodi DE i IT", priceMonthlyEur: 12, note: "Njemački i talijanski prijevod jelovnika" },
];

/** Paket koji uključuje sve (mora postojati u HOSPITALITY_PLANS). */
export const FULL_PLAN_KEY: HospitalityPlanKey = "sve";
export const BASE_PLAN_KEY: HospitalityPlanKey = "jelovnik";

/** Jednokratno postavljanje, EUR bez PDV-a. Uključuje tisak stalaka, naljepnicu za vrata i upis jelovnika s fotografije. */
export const SETUP_FEE_EUR = 79;

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

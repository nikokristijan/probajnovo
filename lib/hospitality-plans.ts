/**
 * Paketi i cijene digitalnog jelovnika za kafiće i restorane (stranica /digitalni-jelovnik).
 *
 * VAŽNO: cijene su PRIJEDLOG (čekaju odobrenje vlasnika) i mijenjaju se samo ovdje.
 * Stranica, JSON-LD i padajući izbornik u obrascu za upit čitaju isključivo ovu datoteku,
 * pa promjena iznosa ili popisa stavki ne traži izmjene nigdje drugdje.
 *
 * Pravila: iznosi su u EUR, mjesečno, BEZ PDV-a. Godišnja uplata = 10 mjesečnih iznosa
 * (dva mjeseca manje). Postavljanje je jednokratno i uz godišnju uplatu se ne naplaćuje.
 * Ovo je odvojeno od paketa NOVO Recenzije (lib/recenzije), koji služe obrtima i tvrtkama bez jelovnika.
 */

export type HospitalityPlanKey = "jelovnik" | "jelovnik-recenzije" | "plus";

export type HospitalityPlan = {
  key: HospitalityPlanKey;
  name: string;
  /** Mjesečna cijena u EUR, bez PDV-a. */
  priceMonthlyEur: number;
  /** Kratka oznaka iznad naziva (npr. "Najpopularniji"), ili null. */
  badge: string | null;
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
    priceMonthlyEur: 15,
    badge: null,
    summary: "Samo digitalni jelovnik na QR kodu. Bez brojeva gostiju i bez SMS poruka.",
    smsMonthly: 0,
    features: [
      "Digitalni jelovnik na QR kodu",
      "Unos jelovnika i izmjene cijena i stavki radimo mi",
      "Engleski prijevod",
      "Stolni stalci (jedan komplet)",
      "Naljepnica za vrata",
      "Tipke Wi-Fi, Kontakt i Ocijeni nas kad ih želite",
    ],
  },
  {
    key: "jelovnik-recenzije",
    name: "Jelovnik + Recenzije",
    priceMonthlyEur: 29,
    badge: "Najpopularniji",
    summary: "Jelovnik i jedna poruka gostu s molbom za Google recenziju, uz njegovu privolu.",
    smsMonthly: 200,
    features: [
      "Sve iz paketa Jelovnik",
      "Upis broja gosta uz privolu",
      "Jedna poruka za Google recenziju nakon posjeta (do 200 SMS-ova mjesečno)",
      "Tjedni izvještaj jednom rečenicom",
      "Upozorenje na lošu recenziju",
    ],
  },
  {
    key: "plus",
    name: "Plus",
    priceMonthlyEur: 49,
    badge: null,
    summary: "Sve iz Jelovnik + Recenzije, više poruka i obavijesti gostima koji su na njih pristali.",
    smsMonthly: 500,
    features: [
      "Sve iz paketa Jelovnik + Recenzije",
      "Do 500 SMS-ova mjesečno",
      "Povremene obavijesti gostima o novostima, događanjima i ponudama (samo onima koji su pristali)",
      "Statistika po stolu",
      "Prijevodi na njemački i talijanski",
      "Prioritetna podrška",
    ],
  },
];

/** Jednokratno postavljanje, EUR bez PDV-a. Uključuje tisak stalaka, naljepnicu za vrata i upis jelovnika s fotografije. */
export const SETUP_FEE_EUR = 49;

/** Broj plaćenih mjeseci kod godišnje uplate (umjesto 12). */
export const ANNUAL_PAID_MONTHS = 10;

/** Godišnja cijena paketa: 10 mjesečnih iznosa. */
export function annualPriceEur(monthlyEur: number): number {
  return monthlyEur * ANNUAL_PAID_MONTHS;
}

/** "29 €" (hrvatski zapis, bez decimala kad su iznosi cijeli). */
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

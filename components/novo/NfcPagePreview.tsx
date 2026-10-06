import NfcGuestCard, { type NfcGuestCardData } from "@/components/NfcGuestCard";

/** Izmišljeni apartmani za primjer — prikazuju se pravom komponentom stranice za goste. */
const LAVANDA: NfcGuestCardData = {
  wifiSsid: "Lavanda_Guest",
  wifiPassword: "more2026",
  welcomeTitle: "Dobrodošli u Apartman Lavanda!",
  welcomeText:
    "Drago nam je što ste ovdje. Spojite se na WiFi jednim dodirom, a ispod su kućni red i naše preporuke za okolicu. Ugodan boravak!",
  image: null,
  googleReviewUrl: "https://www.google.com/maps",
  socialUrl: "https://www.instagram.com",
  contactPhone: "+385910000000",
  houseRulesText:
    "Prijava od 14:00, odjava do 10:00\nTišina od 22:00 do 7:00\nPušenje samo na terasi\nKućni ljubimci uz prethodni dogovor",
  localTipsText:
    "Najbliža plaža — 5 min pješice, lijevo uz šetnicu\nKonoba u luci — svježa riba, preporučujemo rezervaciju\nPekara na trgu — otvara u 6:00\nParking — besplatan iza zgrade",
};

const MIRNA: NfcGuestCardData = {
  ...LAVANDA,
  wifiSsid: "Kuca_Mirna",
  wifiPassword: "zalazak25",
  welcomeTitle: "Dobrodošli u Kuću Mirna",
  welcomeText: "Ključ je u kutiji kraj vrata. Mi smo na WhatsAppu ako vam išta zatreba — javite se bez ustručavanja.",
  socialUrl: null,
};

/** offset = koliko je "ekran" pomaknut prema dolje (px u punoj veličini stranice). */
const SHOTS = [
  { key: "wifi", tag: LAVANDA, accent: "#2F6F8F", offset: 0, caption: "WiFi u jednom dodiru", alt: "Dobrodošlica, naziv WiFi mreže, lozinka s gumbom za kopiranje i QR kod" },
  { key: "akcije", tag: LAVANDA, accent: "#2F6F8F", offset: 560, caption: "Recenzija, kontakt, kućni red", alt: "Gumbi za Google recenziju, društvene mreže i WhatsApp te kućni red i lokalne preporuke" },
  { key: "boje", tag: MIRNA, accent: "#B5502E", offset: 0, caption: "Vaše boje i vaša poruka", alt: "Ista stranica u drugoj boji s porukom domaćina" },
];

const FEATURES = [
  "Dobrodošlica s nazivom objekta, vašom porukom i fotografijom",
  "Naziv WiFi mreže i lozinka s gumbom „Kopiraj“",
  "QR kod za automatsko spajanje na WiFi",
  "Gumb „Ostavi nam Google recenziju“",
  "Vaš Instagram ili Facebook i WhatsApp / poziv domaćinu",
  "Kućni red i lokalne preporuke (plaže, restorani, izleti)",
  "Boja stranice po vašem izboru",
  "Promijenili ste lozinku? Mi ažuriramo stranicu, pločica ostaje ista",
];

/**
 * "Što gost vidi" — živi prikaz prave NFC stranice (ista komponenta kao
 * app/nfc/[slug]) u okviru mobitela, s izmišljenim apartmanom, + popis
 * svega što stranica ima. Uključuje se po proizvodu u adminu (showNfcPreview).
 * Bez slika: prikaz se ne može "pokvariti" i uvijek odgovara pravoj stranici.
 */
export default function NfcPagePreview({ monthlyEur = null }: { monthlyEur?: number | null }) {
  return (
    <section className="pd-section nfcp" aria-labelledby="pd-nfcp">
      <h2 id="pd-nfcp" className="section-title">
        STRANICA KOJU GOSTI OTVORE
      </h2>
      <p className="nfcp-lead">
        Gost prisloni mobitel na pločicu ili skenira QR kod i odmah dobije vašu stranicu: bez aplikacije, bez
        diktiranja lozinke. Stranicu postavljamo i održavamo mi
        {monthlyEur != null ? ` (${monthlyEur} € mjesečno)` : ""}. Imate li već svoju stranicu? Pločica može voditi
        i na nju, bez dodatnih troškova.
      </p>
      <div className="nfcp-shots">
        {SHOTS.map((s) => (
          <figure key={s.key} className="nfcp-shot">
            <div className="nfcp-phone" role="img" aria-label={s.alt}>
              <div className="nfcp-screen" aria-hidden="true" inert>
                <div
                  className="nfcp-screen-in"
                  style={{ "--nfc-accent": s.accent, "--nfcp-offset": `${s.offset}px` } as React.CSSProperties}
                >
                  <NfcGuestCard tag={s.tag} />
                </div>
              </div>
            </div>
            <figcaption className="mono">{s.caption.toUpperCase()}</figcaption>
          </figure>
        ))}
      </div>
      <p className="nfcp-note mono">PRIMJER S IZMIŠLJENIM APARTMANOM · VAŠA STRANICA IMA VAŠE PODATKE</p>
      <ul className="nfcp-list">
        {FEATURES.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </section>
  );
}

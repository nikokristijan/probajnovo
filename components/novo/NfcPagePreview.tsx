import Image from "next/image";

const SHOTS = [
  { src: "/nfc-primjer-wifi.png", caption: "WiFi u jednom dodiru", alt: "Dobrodošlica, naziv WiFi mreže, lozinka s gumbom za kopiranje i QR kod" },
  { src: "/nfc-primjer-akcije.png", caption: "Recenzija, kontakt, kućni red", alt: "Gumbi za Google recenziju, društvene mreže i WhatsApp te kućni red i lokalne preporuke" },
  { src: "/nfc-primjer-boje.png", caption: "Vaše boje i vaša poruka", alt: "Ista stranica u drugoj boji s porukom domaćina" },
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
 * "Što gost vidi" — slike stvarne NFC stranice (app/nfc/[slug]) s primjerom
 * izmišljenog apartmana + popis svega što stranica ima. Uključuje se po
 * proizvodu u adminu (showNfcPreview). Slike su public/nfc-primjer-*.png.
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
          <figure key={s.src} className="nfcp-shot">
            <Image src={s.src} alt={s.alt} width={600} height={1162} sizes="(max-width: 720px) 62vw, 240px" />
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

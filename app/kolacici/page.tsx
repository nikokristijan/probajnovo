import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import ConsentReset from "@/components/novo/ConsentReset";

export const metadata: Metadata = {
  title: "Politika kolačića",
  description: "Koje kolačiće probajnovo.com koristi i zašto.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/kolacici" },
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Politika kolačića" updated="10. listopada 2026.">
      <p>
        Ova stranica namjerno koristi vrlo malo kolačića — evo potpunog popisa, temeljenog na pregledu
        koda stranice, ne generičkog predloška.
      </p>

      <h2>1. Javne stranice (naslovnica, vikendice, firme, proizvodi)</h2>
      <p>
        Bez vašeg pristanka javne stranice <strong>ne postavljaju kolačiće za praćenje ili marketing</strong>.
        Osnovnu statistiku posjećenosti mjerimo preko Vercel Analytics, koji prema dokumentaciji pružatelja
        radi bez kolačića (ne sprema identifikator u vaš preglednik).
      </p>
      <p>
        Na NOVO naslovnici i stranicama proizvoda možete vidjeti baner &bdquo;Kolačići&ldquo;. Tek ako
        kliknete <strong>Prihvaćam</strong>, učitavaju se alati za mjerenje oglasa opisani u točki 3.
        Kliknete li <strong>Odbijam</strong>, ništa se ne učitava, a stranica radi jednako. Vaš izbor
        pamtimo samo u vašem pregledniku (localStorage), ne na našem poslužitelju.
      </p>

      <h2>2. Prijava u admin sučelje</h2>
      <p>
        Ako ste vlasnik vikendice/firme ili član NOVO tima i prijavljujete se u admin sučelje
        (probajnovo.com/admin), stranica postavlja jedan <strong>strogo neophodan</strong> kolačić koji
        pamti vašu prijavljenu sesiju (httpOnly, nije dostupan JavaScriptu, briše se odjavom ili istekom).
        Ovaj kolačić je nužan da bi prijava uopće funkcionirala i ne koristi se za praćenje niti oglašavanje
        — po ePrivacy pravilima spada u izuzetak &bdquo;strogo neophodni kolačići&ldquo; za koji nije
        potreban poseban pristanak.
      </p>

      <h2>2a. Jelovnik za goste (probajnovo.com/jelovnik/…)</h2>
      <p>
        Stranice digitalnog jelovnika ugostiteljskih lokala postavljaju samo funkcionalne kolačiće koji
        su vam potrebni za ono što ste sami zatražili. Ne koriste se za praćenje ni oglašavanje, a nijedan
        ne sadrži osobne podatke:
      </p>
      <ul>
        <li>
          <strong>Kolačić prolaska vrata jelovnika</strong> (httpOnly, potpisan): pamti da ste već upisali
          broj i potvrdili privolu, pa vas nekoliko tjedana ne pitamo ponovno (do 30 dana). Postavlja se
          tek nakon unosa broja.
        </li>
        <li>
          <strong>Kratka potvrda</strong> (httpOnly, 30 sekundi): jednokratno prikazuje poruku &bdquo;Broj je
          zaprimljen&ldquo; s djelomično skrivenim brojem.
        </li>
        <li>
          <strong>Kolačić jezika</strong> (do godinu dana): pamti hrvatski ili engleski jelovnik, samo ako
          sami odaberete jezik.
        </li>
      </ul>
      <p>
        Što se sprema kad upišete broj, opisano je u <Link href="/privatnost">politici privatnosti</Link>.
      </p>

      <h2>3. Kolačići trećih strana</h2>
      <p>
        <strong>Samo uz vaš pristanak</strong> koristimo Meta Pixel (Meta Platforms Ireland Ltd.) i
        Google Analytics (Google Ireland Ltd.). Oni postavljaju kolačiće poput <code>_fbp</code> i{" "}
        <code>_ga</code> kako bismo vidjeli koliko je posjetitelja došlo s naših oglasa na Instagramu,
        Facebooku ili Googleu, koje su proizvode pogledali i je li poslan upit. Podatke iz obrasca
        (ime, email, telefon) tim alatima ne šaljemo. Takvi kolačići traju do 2 godine, osim ako ih
        ranije ne obrišete.
      </p>
      <p>
        Ako neka vikendica/firma na svojoj stranici ugradi video s YouTubea ili Vimea,
        taj vanjski servis može pri reprodukciji postaviti svoj kolačić — to je izvan naše kontrole i
        podliježe politici privatnosti YouTubea/Vimea.
      </p>

      <h2>4. Kako upravljati kolačićima</h2>
      <p>
        Svoj izbor možete promijeniti u svakom trenutku:
      </p>
      <ConsentReset />
      <p>
        Već postavljene kolačiće (i kolačić prijave u admin sučelje) možete obrisati kroz postavke
        preglednika. Brisanjem kolačića prijave bit ćete odjavljeni.
      </p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description: "Kako NOVO prikuplja, koristi i štiti osobne podatke posjetitelja i klijenata.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/privatnost" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Politika privatnosti" updated="21. rujna 2026.">
      <p>
        <strong>
          Ovo je predložak politike privatnosti prilagođen uslugama i podacima koje NOVO stvarno
          prikuplja, izrađen na temelju pregleda koda stranice. Nije zamjena za pravni savjet —
          preporučujemo da ga prije objave pregleda odvjetnik ili DPO, posebno dio o pravnoj
          osnovi obrade i rokovima čuvanja podataka.
        </strong>
      </p>

      <h2>1. Tko smo mi</h2>
      <p>
        Voditelj obrade podataka je <strong>[ovdje upiši puni pravni naziv obrta/tvrtke i OIB]</strong>,
        koji posluje pod nazivom NOVO, sa sjedištem u Slavonskom Brodu, Hrvatska. Za sva pitanja o
        obradi osobnih podataka možete nas kontaktirati na{" "}
        <a href="mailto:hello@novo.studio">hello@novo.studio</a>.
      </p>

      <h2>2. Koje podatke prikupljamo</h2>
      <p>Kroz kontakt/upit obrasce na stranici prikupljamo samo podatke koje nam sami pošaljete:</p>
      <ul>
        <li>ime i prezime,</li>
        <li>email adresu,</li>
        <li>telefon (opcionalno polje),</li>
        <li>sadržaj poruke koju upišete.</li>
      </ul>
      <p>
        Dodatno, radi zaštite od zlouporabe (spam/botovi) privremeno bilježimo IP adresu pošiljatelja
        upita — koristi se isključivo za ograničavanje broja upita s iste adrese u kratkom razdoblju,
        ne za praćenje ili profiliranje.
      </p>

      <h2>3. Svrha i pravna osnova obrade</h2>
      <p>
        Podatke iz upita obrađujemo radi odgovaranja na vaš upit i eventualnog sklapanja ugovora o
        usluzi (izrada web stranice, NFC pločice, prostorna slova i sl.) — pravna osnova je poduzimanje
        koraka na vaš zahtjev prije sklapanja ugovora, odnosno naš legitimni interes da odgovorimo na
        upit koji ste nam sami uputili.
      </p>

      <h2>4. Analitika</h2>
      <p>
        Za mjerenje posjećenosti koristimo Vercel Analytics, koji prema dokumentaciji pružatelja ne
        koristi kolačiće niti prikuplja podatke koji identificiraju pojedinog posjetitelja — prikazuje
        samo zbirne, anonimizirane statistike (broj posjeta, popularne stranice i sl.).
      </p>

      <h2>5. Dijeljenje podataka s trećim stranama</h2>
      <p>
        Ne prodajemo i ne iznajmljujemo vaše podatke. Podaci se dijele isključivo s pružateljima usluga
        nužnima za rad stranice — hosting i baza podataka (Vercel) — koji podatke obrađuju u naše ime,
        pod istim standardima zaštite.
      </p>

      <h2>6. Koliko dugo čuvamo podatke</h2>
      <p>
        Podatke iz upita čuvamo dok su relevantni za naš poslovni odnos s vama, a najdulje 3 godine od
        zadnjeg kontakta, osim ako zakon zahtijeva dulje čuvanje (npr. računovodstvena dokumentacija) ili
        ako prije toga zatražite brisanje.
      </p>

      <h2>7. Vaša prava</h2>
      <p>Sukladno GDPR-u, u svakom trenutku imate pravo:</p>
      <ul>
        <li>zatražiti uvid u podatke koje o vama imamo,</li>
        <li>zatražiti ispravak netočnih podataka,</li>
        <li>zatražiti brisanje podataka,</li>
        <li>uložiti prigovor na obradu,</li>
        <li>zatražiti prenosivost podataka.</li>
      </ul>
      <p>
        Zahtjev možete poslati na <a href="mailto:hello@novo.studio">hello@novo.studio</a> — odgovaramo
        u najkraćem mogućem roku, a najkasnije u zakonskom roku od mjesec dana.
      </p>

      <h2>8. Sigurnost podataka</h2>
      <p>
        Sav promet prema stranici ide preko HTTPS enkripcije. Pristup admin sučelju gdje se upiti
        pregledavaju zaštićen je lozinkom i, opcionalno, dvofaktorskom autentifikacijom.
      </p>

      <h2>9. Maloljetnici</h2>
      <p>Stranica nije namijenjena osobama mlađim od 16 godina i svjesno ne prikupljamo njihove podatke.</p>

      <h2>10. Izmjene ove politike</h2>
      <p>
        Ovu politiku možemo povremeno ažurirati — datum zadnje izmjene naveden je na vrhu stranice.
        Veće izmjene ćemo istaknuti na stranici.
      </p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description: "Kako NOVO prikuplja, koristi i štiti osobne podatke posjetitelja i klijenata.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/privatnost" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Politika privatnosti" updated="10. listopada 2026.">
      <p>
        Vaša privatnost nam je važna. Ova politika objašnjava koje osobne podatke prikupljamo kad
        koristite stranicu probajnovo.com i naše usluge, zašto ih obrađujemo i koja prava imate.
      </p>

      <h2>1. Tko smo mi</h2>
      <p>
        Voditelj obrade podataka je <strong>NOVO</strong>, kreativna agencija sa sjedištem u Slavonskom
        Brodu, Hrvatska. Za sva pitanja o obradi osobnih podataka možete nas kontaktirati na{" "}
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
      <p>
        Ako na baneru za kolačiće prihvatite mjerenje, Meta (Pixel) i Google (Analytics) primaju
        podatke o posjetu (npr. koju ste stranicu i proizvod pogledali te jeste li poslali upit) radi
        mjerenja učinka naših oglasa. Podatke koje upišete u obrazac tim pružateljima ne šaljemo.
        Detalji i promjena izbora: <Link href="/kolacici">Politika kolačića</Link>.
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

      <h2>10. NOVO Recenzije (usluga za naše klijente)</h2>
      <p>
        Uz web stranicu nudimo i uslugu NOVO Recenzije (<Link href="/recenzije">probajnovo.com/recenzije</Link>).
        Uslugu vodimo mi: klijent nam javlja završene poslove, a mi u njegovo ime šaljemo poruke s
        NOVO pošiljatelja (telefonskog broja ili oznake pošiljatelja), potpisane nazivom klijentove tvrtke. U toj usluzi NOVO je{" "}
        <strong>izvršitelj obrade</strong>, a voditelj obrade je poduzeće koje nam je predalo kontakte
        (naš klijent) i koje odlučuje kome se šalje. Klijent potvrđuje da ima pravo kontaktirati osobe
        čije nam kontakte predaje (postojeći odnos, usluga koju im je pružio).
      </p>
      <p>Za rad usluge obrađujemo:</p>
      <ul>
        <li>kontakt podatke poduzeća (naziv, kontakt osoba, email na koji šaljemo tjedni izvještaj),</li>
        <li>podatke o primateljima poruka koje nam poduzeće preda (ime, broj telefona, email, usluga i datum usluge),</li>
        <li>tekst i status poslanih SMS poruka te bilježe klikova na poveznicu za recenziju (vrijeme klika),</li>
        <li>javno dostupne Google recenzije poduzeća (ime autora, ocjena, tekst, datum).</li>
      </ul>
      <p>
        Primatelj poruke može se u svakom trenutku odjaviti odgovorom „STOP” (uputa je na kraju poruke) ili, gdje mreža
        ne omogućuje odgovore, poveznicom za odjavu u poruci, nakon čega mu više ne šaljemo poruke. Odjava vrijedi za sva poduzeća koja
        koriste NOVO Recenzije, pa taj broj telefona više ne prima poruke ni od jednog od njih. Podatke koristimo samo za pružanje usluge, ne prodajemo ih i ne koristimo ih za
        oglašavanje. Podaci jednog poduzeća logički su odvojeni od podataka drugih poduzeća.
      </p>
      <p>
        Za slanje i obradu koristimo podizvršitelje: Vercel i Neon (hosting i baza), Twilio (slanje SMS poruka: broj
        primatelja i tekst poruke prosljeđuju se radi isporuke), po potrebi SMS Gateway for Android (aplikacija
        na NOVO telefonu kojom šaljemo SMS), Anthropic (AI pisanje poruka — šalje
        se samo ime, usluga i naziv poduzeća, bez broja telefona), Resend (email) i Stripe (naplata,
        ako je uključena). Primatelj poruke zahtjeve za pristup ili brisanje može poslati na{" "}
        <a href="mailto:hello@novo.studio">hello@novo.studio</a> ili poduzeću u čije je ime poruka
        poslana.
      </p>

      <h2>11. Jelovnik s QR kodom (kafići i restorani)</h2>
      <p>
        Ugostiteljskim lokalima koji koriste NOVO Recenzije možemo izraditi digitalni jelovnik na adresi
        probajnovo.com/jelovnik/… s nazivom lokala. Lokal QR kod stavlja na stolove. Za podatke gostiju
        u toj usluzi voditelj obrade je ugostiteljski lokal, a NOVO je <strong>izvršitelj obrade</strong>,
        kao i u odjeljku 10. Podaci jednog lokala logički su odvojeni od podataka drugih.
      </p>
      <p>
        Prije jelovnika lokal od gosta može tražiti broj mobitela. Ako lokal dopušta pregled bez broja,
        na stranici je poveznica „Pogledaj jelovnik bez unosa broja”; tada broj ne tražimo i ne spremamo.
        Ako broj upišete, spremamo:
      </p>
      <ul>
        <li>broj mobitela (u međunarodnom obliku),</li>
        <li>vrijeme unosa i privole te verziju i točan tekst privole koji ste vidjeli (dokaz privole),</li>
        <li>broj stola, ako je naveden u adresi QR koda,</li>
        <li>
          tehničke podatke u obliku sažetaka: nepovratni sažetak IP adrese (samu IP adresu ne spremamo) i
          skraćenu oznaku preglednika, samo radi zaštite od zlouporabe,
        </li>
        <li>zapis o poslanoj poruci (tekst, status isporuke i klik na poveznicu za recenziju).</li>
      </ul>
      <p>
        <strong>Svrha:</strong> isključivo da vam lokal preko NOVO Recenzija jednom pošalje SMS s molbom za
        Google recenziju, otprilike u vremenu navedenom uz polje za broj (obično sat i pol nakon unosa,
        najmanje sat, najviše četiri sata). Između 22:00 i 9:00 poruka se ne šalje, nego stiže ujutro.
        Isti lokal istom broju ne šalje novi zahtjev unutar 30 dana. Broj se ne koristi ni za što drugo, ni za
        oglašavanje ni za druge poruke. Sažetke IP adrese koristimo za ograničavanje broja unosa i
        sprječavanje zlouporabe (naš legitimni interes).
      </p>
      <p>
        <strong>Pravna osnova:</strong> vaša privola (čl. 6. st. 1. t. (a) Opće uredbe o zaštiti podataka),
        koju dajete potvrdom polja uz unos broja. Privola mora biti dobrovoljna, pa lokalu preporučujemo da
        gostima omogući pregled jelovnika i bez broja. Privolu možete povući u svakom trenutku odgovorom
        „STOP” (uputa je u poruci) ili, gdje mreža ne omogućuje odgovore, poveznicom za odjavu u poruci;
        povlačenje ne utječe na zakonitost obrade prije povlačenja. Vrijedi i pravilo iz odjeljka 10: odjava
        vrijedi za sva poduzeća koja koriste NOVO Recenzije.
      </p>
      <p>
        <strong>Rok čuvanja:</strong> broj i ostale podatke o unosu čuvamo najviše 12 mjeseci od unosa, a
        zatim ih automatski brišemo zajedno s pripadajućim zapisima o poslanoj poruci. Iznimka je odjava:
        ako ste se odjavili, i dalje čuvamo samo broj s oznakom da se odjavio, isključivo da vam poruke
        ne bismo ponovno slali (nakon ponovnog unosa broja), i ne koristimo ga ni za što drugo.
      </p>
      <p>
        <strong>Kolačići:</strong> nakon unosa broja preglednik dobiva potpisani kolačić koji samo pamti
        da ste već prošli vrata jelovnika, kako vas ne bismo ponovno pitali za broj (do 30 dana). U njemu nema
        osobnih podataka. Uz njega se na 30 sekundi sprema kratka potvrda s djelomično skrivenim brojem
        (prikazuje se samo vama, odmah nakon unosa). Ako odaberete jezik jelovnika, pamti se i taj izbor
        (kolačić jezika, do godinu dana). Svi se brišu brisanjem kolačića u pregledniku. Popis kolačića
        je i u <Link href="/kolacici">politici kolačića</Link>.
      </p>
      <p>
        <strong>Vaša prava i primjedbe:</strong> za uvid, ispravak ili brisanje obratite se lokalu ili nama na{" "}
        <a href="mailto:hello@novo.studio">hello@novo.studio</a>. Broj je moguće upisati i bez provjere, pa ako
        ste primili poruku iako niste skenirali kod, odgovorite „STOP” ili nam se javite i broj brišemo.
        Pritužbu možete podnijeti i Agenciji za zaštitu osobnih podataka (azop.hr). Podizvršitelji su isti kao
        u odjeljku 10.
      </p>

      <h2>12. Izmjene ove politike</h2>
      <p>
        Ovu politiku možemo povremeno ažurirati — datum zadnje izmjene naveden je na vrhu stranice.
        Veće izmjene ćemo istaknuti na stranici.
      </p>
    </LegalPage>
  );
}

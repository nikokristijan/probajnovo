import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Politika privatnosti",
  description: "Kako NOVO prikuplja, koristi i štiti osobne podatke posjetitelja, gostiju i klijenata.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/privatnost" },
};

const EMAIL = "hello@probajnovo.com";

/**
 * Privremena politika privatnosti (vrijedi dok se ne izradi konačna verzija
 * uz pravni pregled). Opisuje samo obrade koje kod probajnova stvarno radi:
 * upiti, stranice vikendica/firmi, NFC stranice za goste, admin te NOVO
 * Recenzije (SMS zahtjevi za recenziju u ime tvrtki).
 */
export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Politika privatnosti" updated="7. listopada 2026.">
      <p>
        Ovo je privremena verzija politike privatnosti. Opisuje kako NOVO danas obrađuje osobne podatke i vrijedi dok ne
        objavimo konačnu verziju. Svaku izmjenu označit ćemo datumom na vrhu ove stranice.
      </p>

      <h2>1. Tko smo i kako nas kontaktirati</h2>
      <p>
        Stranicu probajnovo.com i povezane usluge vodi NOVO, kreativni studio iz Slavonskog Broda, Hrvatska. Za sva pitanja o
        osobnim podacima pišite na <a href={`mailto:${EMAIL}`}>{EMAIL}</a> ili nazovite +385 97 653 7001.
      </p>

      <h2>2. Koje podatke obrađujemo i zašto</h2>
      <h3>Upiti i kontakt</h3>
      <p>
        Kad nam pošaljete upit (za web stranicu, NFC pločicu, prostorna slova, NOVO Recenzije ili drugu uslugu), obrađujemo ime
        i prezime, e-mail, telefon ako ga upišete i sadržaj poruke. Koristimo ih da vam odgovorimo i pripremimo ponudu. Pravna
        osnova je poduzimanje koraka na vaš zahtjev prije sklapanja ugovora (čl. 6. st. 1. t. b GDPR-a).
      </p>
      <p>
        Radi zaštite od spama kratko bilježimo IP adresu pošiljatelja upita, samo da ograničimo broj upita s iste adrese. Ako
        ste upit poslali s oglasa, uz poruku spremamo i oznaku oglasa (npr. kampanju), da znamo koji oglasi rade.
      </p>

      <h3>Stranice vikendica, apartmana i firmi</h3>
      <p>
        Na stranicama koje izrađujemo za naše klijente (npr. vikendice na poddomenama probajnovo.com) gosti mogu poslati upit za
        smještaj ili uslugu. Te podatke obrađujemo u ime vlasnika objekta ili firme, koji je voditelj obrade, i prosljeđujemo
        ih njemu. Vlasnik ih koristi za odgovor na vaš upit i rezervaciju.
      </p>

      <h3>NFC pločice i stranice za goste</h3>
      <p>
        Stranica koja se otvori prislanjanjem mobitela na NFC pločicu prikazuje podatke za goste (npr. WiFi). Na njoj ne tražimo
        nikakve osobne podatke i ne pratimo pojedine goste.
      </p>

      <h3>NOVO Recenzije</h3>
      <p>
        NOVO Recenzije je usluga koju NOVO vodi za obrte i tvrtke: nakon obavljene usluge njihovim klijentima šaljemo SMS s
        poveznicom za Google recenziju. Za tu uslugu obrađujemo podatke koje nam tvrtka dostavi o svojim klijentima: ime,
        broj mobitela, po želji e-mail, vrstu i datum usluge. Pri tome je tvrtka voditelj obrade, a NOVO izvršitelj obrade koji
        podatke koristi isključivo po uputi tvrtke i samo za tu svrhu.
      </p>
      <ul>
        <li>
          Poveznica u SMS-u je osobna. Kad je otvorite, bilježimo da je kliknuta, vrijeme klika, vrstu preglednika i skraćeni
          (hashirani) zapis IP adrese, pa vas preusmjeravamo na Google.
        </li>
        <li>
          Ako odgovorite <strong>STOP</strong>, više vam ne šaljemo poruke za tu tvrtku.
        </li>
        <li>
          Javne Google recenzije tvrtke preuzimamo da bi tvrtka vidjela koliko recenzija stiže. Povezujemo ih s klijentom samo
          kad se ime na recenziji točno podudara ili kad to ručno označi tvrtka.
        </li>
      </ul>
      <p>
        Ako ste dobili takav SMS i želite znati koji su podaci o vama spremljeni ili ih želite obrisati, javite se tvrtki koja
        vam je pružila uslugu ili izravno nama na <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>

      <h3>Prijave u admin i aplikacije</h3>
      <p>
        Za korisnike s pristupom (naš tim, vlasnici objekata, tvrtke) spremamo e-mail, ime, šifriranu lozinku i podatke o
        prijavi. Kolačić za prijavu je nužan da biste ostali prijavljeni.
      </p>

      <h2>3. Analitika i kolačići</h2>
      <p>
        Posjećenost mjerimo alatom Vercel Analytics, koji ne koristi kolačiće i prikazuje samo zbirne statistike. Ako na
        baneru za kolačiće prihvatite mjerenje, Meta (Pixel) i Google (Analytics) primaju podatke o posjetu radi mjerenja
        učinka oglasa. Podatke iz obrazaca tim pružateljima ne šaljemo. Detalji i promjena izbora:{" "}
        <Link href="/kolacici">Politika kolačića</Link>.
      </p>

      <h2>4. S kim dijelimo podatke</h2>
      <p>Podatke ne prodajemo. Dijelimo ih samo s pružateljima usluga koji ih obrađuju u naše ime:</p>
      <ul>
        <li>Vercel (hosting, baza podataka i spremanje slika),</li>
        <li>Resend (slanje e-mail obavijesti i poveznica za lozinku),</li>
        <li>
          za NOVO Recenzije: mobitel tvrtke s aplikacijom SMS Gateway for Android ili Twilio (slanje SMS-a), Google (Business
          Profile, recenzije), po potrebi Anthropic (AI prijedlozi teksta poruka; pritom se može poslati najviše ime klijenta, nikad broj mobitela) i Stripe
          (naplata pretplate tvrtkama).
        </li>
      </ul>
      <p>
        Neki od tih pružatelja imaju sjedište izvan EU-a. U tim slučajevima prijenos se oslanja na standardne ugovorne klauzule
        ili druge zaštitne mjere koje pružatelj nudi u skladu s GDPR-om.
      </p>

      <h2>5. Koliko dugo čuvamo podatke</h2>
      <ul>
        <li>Upiti: dok su potrebni za naš poslovni odnos, a najdulje 3 godine od zadnjeg kontakta.</li>
        <li>
          Podaci klijenata u NOVO Recenzijama: dok tvrtka koristi uslugu. Nakon prestanka suradnje brišemo ih u roku od 90 dana,
          osim ako tvrtka ranije zatraži brisanje.
        </li>
        <li>Računovodstvena dokumentacija: koliko propisuje zakon.</li>
      </ul>

      <h2>6. Vaša prava</h2>
      <p>U skladu s GDPR-om imate pravo:</p>
      <ul>
        <li>na uvid u podatke koje o vama imamo,</li>
        <li>na ispravak netočnih podataka,</li>
        <li>na brisanje podataka,</li>
        <li>na ograničenje obrade i prigovor na obradu,</li>
        <li>na prenosivost podataka.</li>
      </ul>
      <p>
        Zahtjev pošaljite na <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. Odgovaramo najkasnije u roku od mjesec dana. Ako smatrate
        da vaše podatke obrađujemo protivno propisima, možete podnijeti prigovor Agenciji za zaštitu osobnih podataka (AZOP,
        azop.hr).
      </p>

      <h2>7. Sigurnost</h2>
      <p>
        Sav promet ide preko HTTPS-a. Lozinke spremamo samo u šifriranom obliku, pristupni podaci za Google i SMS uslugu su
        šifrirani, a admin je zaštićen lozinkom i po želji dvofaktorskom autentifikacijom.
      </p>

      <h2>8. Maloljetnici</h2>
      <p>Usluge nisu namijenjene osobama mlađim od 16 godina i svjesno ne prikupljamo njihove podatke.</p>

      <h2>9. Izmjene</h2>
      <p>
        Ovu privremenu politiku zamijenit ćemo konačnom verzijom. Datum zadnje izmjene uvijek je naveden na vrhu stranice.
      </p>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Uvjeti korištenja",
  description: "Uvjeti korištenja probajnovo.com i usluga koje NOVO nudi.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/uvjeti" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Uvjeti korištenja" updated="7. listopada 2026.">
      <h2>1. Prihvaćanje uvjeta</h2>
      <p>
        Korištenjem probajnovo.com i slanjem upita prihvaćate ove uvjete. Ako se s njima ne slažete,
        molimo da ne koristite stranicu.
      </p>

      <h2>2. Opis usluga</h2>
      <p>NOVO nudi:</p>
      <ul>
        <li>kreativne usluge — brend identitet, digitalni dizajn, film i motion, marketing,</li>
        <li>izradu web stranica za vikendice i firme (paketi dostupni na upit),</li>
        <li>fizičke proizvode — NFC pločice (WiFi/Google recenzije) i prostorna slova po mjeri.</li>
      </ul>

      <h2>3. Narudžbe i cijene</h2>
      <p>
        Cijene prikazane na stranici (npr. &bdquo;od 4 €/slovo&ldquo;) su informativne polazišne cijene.
        Konačna cijena i rok izrade potvrđuju se u ponudi nakon što pošaljete upit i dogovorimo detalje
        (količina, materijal, opseg posla). Sve cijene su u eurima.
      </p>

      <h2>4. Plaćanje</h2>
      <p>
        Način i dinamika plaćanja (predujam, plaćanje po ispostavljenom računu i sl.) dogovaraju se
        pojedinačno za svaku narudžbu i navode se u ponudi/računu. Rok plaćanja naveden je na računu.
      </p>

      <h2>5. Izrada i isporuka fizičkih proizvoda</h2>
      <p>
        NFC pločice i prostorna slova rade se po narudžbi, prema specifikaciji dogovorenoj u ponudi.
        Rok izrade ovisi o opsegu narudžbe i navodi se u ponudi — obično odgovaramo na upit unutar 24h
        s okvirnim rokom.
      </p>

      <h2>6. Intelektualno vlasništvo</h2>
      <p>
        Dizajn, kod i sadržaj probajnovo.com vlasništvo su NOVO-a. Sadržaj koji nam klijent dostavi
        (fotografije, tekstovi, logotip) ostaje vlasništvo klijenta — mi ga koristimo isključivo za
        izradu ugovorene usluge. Gotov rad izrađen za klijenta (npr. dizajn web stranice, brend
        materijali) prelazi u vlasništvo klijenta po podmirenju cjelokupnog iznosa, osim ako je
        ugovoreno drukčije.
      </p>

      <h2>7. Ograničenje odgovornosti</h2>
      <p>
        Trudimo se da su svi podaci na stranici točni i ažurni, no ne jamčimo da su bez pogrešaka.
        Vikendice i firme prikazane na probajnovo.com samostalno odgovaraju za točnost svojeg sadržaja
        (opis, cijene, dostupnost) — NOVO je izrađivač stranice, ne rezervacijska platforma niti
        posrednik u rezervaciji.
      </p>

      <h2>8. NOVO Recenzije</h2>
      <p>
        NOVO Recenzije je usluga koju za vas vodi NOVO: u vaše ime šaljemo zahtjeve za Google
        recenzije vašim klijentima (SMS i, po dogovoru, email). Vi nemate račun niti obveze oko
        postavljanja; završene poslove nam javljate porukom ili popisom, a mi ih unosimo i šaljemo
        poruke.
      </p>
      <p>
        Poruke se šalju s NOVO telefonskog broja, u vaše ime, i potpisane su nazivom vaše tvrtke.
        Predajom kontakata svojih klijenata potvrđujete da imate pravo kontaktirati te osobe (riječ
        je o klijentima kojima ste pružili uslugu i koji su vam zbog nje dali kontakt) i da nam ne
        predajete kontakte osoba koje to ne žele. Ne šaljemo neželjene poruke, a svaka odjava
        (odgovor „STOP”) poštuje se i toj osobi više ne šaljemo poruke. Za osobne podatke tih osoba
        NOVO je izvršitelj obrade, a vi ste voditelj obrade; detalje opisuje{" "}
        <Link href="/privatnost">politika privatnosti</Link>.
      </p>
      <p>
        Recenzije objavljuje Google i ne možemo jamčiti njihov broj, ocjenu niti da će ih Google
        prikazati ili zadržati. Ne lažiramo recenzije i ne skrivamo loše ocjene. Opseg paketa (npr.
        broj poruka mjesečno) i cijena dogovaraju se u ponudi; cijene su bez PDV-a, naplata je
        mjesečna, a uslugu možete otkazati u bilo kojem trenutku, bez ugovorne obveze.
      </p>

      <h2>9. Vanjske poveznice</h2>
      <p>
        Stranica može sadržavati poveznice na vanjske servise (Instagram, Google karte, YouTube/Vimeo
        video). Ne odgovaramo za sadržaj ili politike privatnosti tih vanjskih stranica.
      </p>

      <h2>10. Mjerodavno pravo</h2>
      <p>Na ove uvjete primjenjuje se pravo Republike Hrvatske.</p>

      <h2>11. Izmjene uvjeta</h2>
      <p>Uvjete možemo povremeno ažurirati — datum zadnje izmjene naveden je na vrhu stranice.</p>

      <h2>12. Kontakt</h2>
      <p>
        Pitanja o ovim uvjetima šaljite na <a href="mailto:hello@novo.studio">hello@novo.studio</a>.
      </p>
    </LegalPage>
  );
}

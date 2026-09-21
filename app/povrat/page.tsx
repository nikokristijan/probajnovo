import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Politika povrata",
  description: "Pravila povrata i reklamacija za usluge i fizičke proizvode NOVO studija.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/povrat" },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Politika povrata" updated="21. rujna 2026.">
      <p>
        <strong>
          Ovo je predložak usklađen s općim pravilima Zakona o zaštiti potrošača i EU direktive o
          pravima potrošača (posebno izuzetak za proizvode izrađene po mjeri) — nije zamjena za pravni
          savjet. Preporučujemo da ga prije objave pregleda odvjetnik.
        </strong>
      </p>

      <h2>1. Kreativne i web usluge</h2>
      <p>
        Ako ste potrošač (fizička osoba koja naručuje izvan svoje poslovne djelatnosti) i posao još nije
        započet uz vaš izričit pristanak, imate pravo odustati od usluge u roku 14 dana od potvrde
        narudžbe, bez navođenja razloga. Ako ste izričito zatražili da rad počne prije isteka tog roka
        i posao je u tijeku ili dovršen, pravo na povrat se razmjerno umanjuje za već obavljeni dio
        posla.
      </p>

      <h2>2. NFC pločice i prostorna slova — proizvodi izrađeni po mjeri</h2>
      <p>
        NFC pločice (personalizirane s vašim WiFi podacima ili poveznicom na recenzije) i prostorna
        slova (izrađena po vašem odabiru fonta, dimenzija, boje i teksta) izrađuju se pojedinačno, po
        narudžbi i specifikaciji svakog klijenta.
      </p>
      <p>
        Sukladno članku 16(c) EU Direktive o pravima potrošača (i odgovarajućim odredbama hrvatskog
        Zakona o zaštiti potrošača), <strong>pravo na jednostrani raskid ugovora u roku 14 dana ne
        primjenjuje se na robu izrađenu po specifikaciji potrošača ili jasno personaliziranu robu</strong>.
        To znači da nakon što potvrdite narudžbu i izrada započne, standardni povrat &bdquo;bez razloga&ldquo;
        nije moguć.
      </p>

      <h2>3. Neispravan ili oštećen proizvod</h2>
      <p>
        Bez obzira na gornju iznimku, i dalje odgovaramo za materijalne nedostatke proizvoda sukladno
        zakonu (npr. proizvod stigne oštećen u dostavi, NFC čip ne radi, slova ne odgovaraju
        dogovorenoj narudžbi). U tom slučaju javite nam se u roku 2 mjeseca od uočavanja nedostatka na{" "}
        <a href="mailto:hello@novo.studio">hello@novo.studio</a> s opisom problema i fotografijom —
        proizvod ćemo besplatno popraviti, zamijeniti ili, ako to nije moguće, izvršiti povrat sredstava.
      </p>

      <h2>4. Poslovni klijenti (B2B)</h2>
      <p>
        Ako narudžbu obavljate kao tvrtka/obrt za potrebe svoje poslovne djelatnosti (ne kao potrošač),
        gornja zakonska prava potrošača se ne primjenjuju — uvjeti povrata za takve narudžbe dogovaraju
        se pojedinačno u ponudi/ugovoru.
      </p>

      <h2>5. Kako pokrenuti povrat ili reklamaciju</h2>
      <p>
        Pišite nam na <a href="mailto:hello@novo.studio">hello@novo.studio</a> s brojem narudžbe/ponude
        i opisom razloga — javljamo se unutar 24h s daljnjim koracima.
      </p>
    </LegalPage>
  );
}

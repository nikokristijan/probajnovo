import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Politika kolačića",
  description: "Koje kolačiće probajnovo.com koristi i zašto.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/kolacici" },
};

export default function CookiePolicyPage() {
  return (
    <LegalPage title="Politika kolačića" updated="21. rujna 2026.">
      <p>
        Ova stranica namjerno koristi vrlo malo kolačića — evo potpunog popisa, temeljenog na pregledu
        koda stranice, ne generičkog predloška.
      </p>

      <h2>1. Javne stranice (naslovnica, vikendice, firme, proizvodi)</h2>
      <p>
        Javne stranice <strong>ne postavljaju kolačiće za praćenje ili marketing</strong>. Statistiku
        posjećenosti mjerimo preko Vercel Analytics, koji prema dokumentaciji pružatelja radi bez
        kolačića (ne sprema identifikator u vaš preglednik) — zato ovdje nema banera za pristanak na
        kolačiće: nemamo neophodne kolačiće za koje bi po zakonu trebali tražiti privolu.
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

      <h2>3. Kolačići trećih strana</h2>
      <p>
        Ne koristimo Google Analytics, Facebook Pixel niti druge marketinške/oglašivačke kolačiće
        trećih strana. Ako neka vikendica/firma na svojoj stranici ugradi video s YouTubea ili Vimea,
        taj vanjski servis može pri reprodukciji postaviti svoj kolačić — to je izvan naše kontrole i
        podliježe politici privatnosti YouTubea/Vimea.
      </p>

      <h2>4. Kako upravljati kolačićima</h2>
      <p>
        Budući da javne stranice ne postavljaju kolačiće koji zahtijevaju pristanak, nema postavki za
        isključivanje na samoj stranici. Kolačić prijave u admin sučelje možete obrisati u svakom
        trenutku kroz postavke preglednika, čime ćete biti odjavljeni.
      </p>
    </LegalPage>
  );
}

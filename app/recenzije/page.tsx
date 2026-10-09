import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import NovoShell from "@/components/novo/NovoShell";
import { RecenzijeInquiryForm } from "@/components/recenzije/inquiry-form";
import { PhoneMockup } from "@/components/recenzije/phone";
import { Button } from "@/components/recenzije/ui/button";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { formatEur } from "@/lib/recenzije/status";
import { listPlans } from "@/lib/recenzije/services/billing";
import { getAgencyContact } from "@/lib/novoHomeData";
import { telHref, whatsappUrl } from "@/lib/phone";

export const dynamic = "force-dynamic";

const BASE_URL = "https://www.probajnovo.com";

export const metadata: Metadata = {
  title: { absolute: "Google recenzije za vašu tvrtku – NOVO" },
  description:
    "Mi vam skupljamo Google recenzije, vi ne radite ništa. Nakon svakog posla klijent dobije SMS potpisan imenom vaše tvrtke, mi pratimo klikove i šaljemo podsjetnike, a vi tjedno dobivate izvještaj emailom.",
  alternates: { canonical: `${BASE_URL}/recenzije` },
};

const STEPS = [
  {
    title: "Javite nam se",
    text: "Pošaljite jedan kratak upit s nazivom tvrtke. Javljamo se unutar 24 sata, dogovaramo detalje i preuzimamo sve ostalo.",
  },
  {
    title: "Mi sve postavimo i šaljemo",
    text: "Postavljamo SMS-ove potpisane imenom vaše tvrtke, praćenje klikova i podsjetnike. Vi ne instalirate ništa i nigdje se ne prijavljujete.",
  },
  {
    title: "Recenzije stižu, vi dobivate izvještaj",
    text: "Klijent jednim dodirom otvara vašu Google stranicu za recenziju. Jednom tjedno vam emailom šaljemo izvještaj: poruke, klikovi i nove recenzije.",
  },
];

const HOW_YOU_REPORT = [
  {
    title: "Pošaljite poruku",
    text: "Kad završite posao, pošaljite nam WhatsApp ili email: ime klijenta, njegov broj mobitela i što ste radili. Dovoljna su dva retka.",
  },
  {
    title: "Ili pošaljite popis",
    text: "Možete nam i jednom tjedno poslati popis odrađenih poslova. Excel, tablica ili fotografija bloka, što god vam je najlakše.",
  },
  {
    title: "Mi to unesemo",
    text: "Mi upišemo klijente u svoj sustav i on pošalje poruku u pravo vrijeme. Vi ne otvarate nikakav program.",
  },
];

const FEATURES = [
  { title: "Potpisano vašim imenom", text: "Svaka poruka spominje vašu tvrtku i vodi izravno na vašu Google stranicu za recenziju." },
  { title: "Praćeni linkovi", text: "Svaki klijent dobije svoj kratki link, pa točno znamo tko je kliknuo i kada." },
  { title: "Automatski podsjetnici", text: "Ako klijent ne klikne, sutradan stiže jedan nenametljiv podsjetnik. Tijek staje čim stigne recenzija." },
  { title: "Tjedni izvještaj", text: "Jednom tjedno dobivate email s brojkama: koliko je poruka poslano, koliko klikova i novih recenzija." },
  { title: "Sve vodimo mi", text: "Postavljanje, tekstove poruka, slanje i praćenje. Vi nemate ni račun, ni aplikaciju, ni postavke." },
  { title: "Pošteno", text: "Ne lažiramo recenzije ni podatke i ne skrivamo loše ocjene. Odjava poveznicom u poruci ili odgovorom STOP poštuje se automatski." },
];

const FAQ = [
  {
    q: "Moram li nešto instalirati ili postavljati?",
    a: "Ne. Nema aplikacije, prijave ni postavljanja. Sve radimo mi, a vi nam samo javite kad je posao završen.",
  },
  {
    q: "Kako vam javljam završene poslove?",
    a: "Pošaljete nam poruku na WhatsApp ili email s imenom i brojem klijenta, ili jednom tjedno popis odrađenih poslova. Mi to upišemo i klijentu šaljemo poruku.",
  },
  {
    q: "S kojeg broja idu SMS-ovi?",
    a: "S našeg NOVO broja ili oznake pošiljatelja, ne s vašeg. Svaka poruka sadrži ime vaše tvrtke, pa klijent odmah zna od koga je. Klijent se može odjaviti poveznicom za odjavu u poruci ili, gdje mreža dopušta odgovore, odgovorom STOP, i više mu ne šaljemo.",
  },
  {
    q: "Kako znate da je klijent ostavio recenziju?",
    a: "Klik na link pratimo točno, a nove recenzije prepoznajemo na vašoj Google stranici. Google ne otkriva tko je napisao recenziju, pa je s klijentom povezujemo samo kad se ime poklapa, inače je brojimo kao novu recenziju bez imena. Ništa ne izmišljamo.",
  },
  {
    q: "Šaljete li link samo zadovoljnim klijentima?",
    a: "Ne. Googleova pravila zabranjuju filtriranje samo na pozitivne recenzije, pa svi klijenti dobiju isti link. Dobra usluga i redovito pitanje rade ostalo.",
  },
  {
    q: "Kome smijemo slati poruke?",
    a: "Samo osobama kojima ste upravo pružili uslugu i koje su vam dale kontakt zbog nje. Ne šaljemo poruke nepoznatim brojevima ni kupljenim bazama.",
  },
  { q: "Mogu li otkazati?", a: "Da, bilo kad. Plaća se mjesečno, bez ugovorne obveze." },
];

/** Što paket uključuje, iz stvarnih ograničenja paketa (ne iz zapisa u bazi koji su pisani za samostalno korištenje). */
function planPoints(p: { smsMonthlyLimit: number; locationLimit: number }) {
  return [
    `${p.smsMonthlyLimit.toLocaleString("hr-HR")} SMS-ova mjesečno`,
    p.locationLimit > 1 ? `Do ${p.locationLimit} ${p.locationLimit % 10 >= 2 && p.locationLimit % 10 <= 4 && (p.locationLimit < 12 || p.locationLimit > 14) ? "lokacije" : "lokacija"}` : "Jedna lokacija",
    "Zahtjev za recenziju nakon svakog posla",
    "Podsjetnik ako klijent ne klikne",
    "Praćenje klikova i novih recenzija",
    "Tjedni izvještaj emailom",
    "Postavljanje i vođenje radimo mi",
  ];
}

const INDUSTRIES = ["Klime i grijanje", "Vodoinstalateri", "Električari", "Stomatolozi", "Frizeri i saloni", "Autoservisi", "Čišćenje", "Restorani", "Apartmani"];

/** Primjer tjednog izvještaja koji klijent dobiva emailom. Izmišljeni podaci, i tako je označeno na stranici. */
const SAMPLE_REPORT: [string, string][] = [
  ["Poslano zahtjeva", "14"],
  ["Klikova na link", "9"],
  ["Novih recenzija", "5"],
  ["Prosječna ocjena novih recenzija", "4,8"],
  ["Podsjetnika na čekanju", "3"],
];

const FLOW = ["Posao gotov", "Vi nam javite", "Čekamo 10 min", "SMS zahtjev", "Čekamo 1 dan", "Podsjetnik", "Recenzija"];

export default async function RecenzijeLanding({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await ensureReviewsDb();
  const [plans, contact, sp] = await Promise.all([listPlans(), getAgencyContact(), searchParams]);
  const cheapest = plans[0]?.priceMonthlyCents;
  const defaultPlan = plans.find((p) => p.key === sp.paket)?.key;

  const waHref = contact.phone ? whatsappUrl(contact.phone, "Pozdrav! Zanima me NOVO Recenzije.") : null;
  const phoneHref = contact.phone ? telHref(contact.phone) : null;
  const mailHref = `mailto:${contact.contactEmail}?subject=${encodeURIComponent("NOVO Recenzije")}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "NOVO Recenzije",
      serviceType: "Prikupljanje Google recenzija",
      description: "NOVO za vašu tvrtku šalje zahtjeve za Google recenzije klijentima, prati klikove i šalje tjedni izvještaj emailom.",
      provider: { "@type": "Organization", name: "NOVO", url: BASE_URL },
      areaServed: { "@type": "Country", name: "Hrvatska" },
      offers: plans.map((p) => {
        const price = (p.priceMonthlyCents / 100).toFixed(2);
        return {
          "@type": "Offer",
          name: p.name,
          price,
          priceCurrency: "EUR",
          priceSpecification: { "@type": "UnitPriceSpecification", price, priceCurrency: "EUR", unitCode: "MON", valueAddedTaxIncluded: false },
        };
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <NovoShell active="products" variant="detail" contactEmail={contact.contactEmail} instagramHandle={contact.instagramHandle} city={contact.city}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="novo-os-panel min-w-0 font-sans">
        <div className="label flex flex-wrap items-center gap-2 text-muted">
          <Link href="/proizvodi" className="text-foreground hover:underline">
            ← Proizvodi
          </Link>
          <span>/</span>
          <span>Google recenzije</span>
        </div>

        {/* Hero */}
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-14">
          <div className="min-w-0">
            <p className="label flex items-center gap-2 text-accent">
              <span className="size-1.5 bg-orange" /> Novo · usluga za obrte i tvrtke
            </p>
            <h1 className="mt-5 text-[38px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[54px]">
              Mi vam skupljamo Google recenzije. Vi ne radite ništa.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
              Nakon svakog vašeg posla klijent dobije SMS potpisan imenom vaše tvrtke, mi pratimo klikove i šaljemo podsjetnike, a vi jednom tjedno dobijete izvještaj emailom.
            </p>
            {cheapest != null && (
              <p className="mt-6 text-2xl font-bold text-accent">
                od {formatEur(cheapest)} <span className="text-base font-normal text-muted">/ mjesec, bez PDV-a</span>
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-1">
              <Button size="lg" asChild>
                <a href="#upit">
                  Pošaljite upit <ArrowRight />
                </a>
              </Button>
            </div>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              {["Ništa za instalirati", "Bez prijave i postavljanja", "Otkaz bilo kad"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-accent" /> {t}
                </span>
              ))}
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-[320px]">
            <PhoneMockup
              sender="NOVO"
              messages={[
                { text: "Bok Ivana! Hvala sto ste odabrali Klima Servis Horvat. Ako imate minutu, kratka Google recenzija bi nam puno znacila: probajnovo.com/r/k3Fq9xLm2a", time: "Danas 14:32" },
                { text: "Ostavila sam 5 zvjezdica, hvala!", from: "client" },
              ]}
            />
            <div className="absolute -left-3 top-24 hidden border border-foreground bg-white px-3 py-2 sm:block lg:-left-10">
              <p className="label text-accent">Link kliknut · 14:41</p>
            </div>
            <div className="absolute -bottom-3 -right-2 hidden border border-foreground bg-white px-3 py-2 sm:block lg:-right-8">
              <p className="label text-muted">Nova recenzija</p>
              <p className="mt-1 text-lg leading-none tracking-widest text-orange" aria-label="5 zvjezdica">
                ★★★★★
              </p>
            </div>
            <p className="mt-8 text-center text-[13px] leading-relaxed text-muted">Poruka stiže s NOVO broja, a potpisana je imenom vaše tvrtke.</p>
          </div>
        </section>

        {/* Kako radi */}
        <section className="border-t border-border py-12" aria-labelledby="kako">
          <h2 id="kako" className="label flex items-center gap-2 text-muted">
            <span className="size-1.5 bg-orange" /> Kako radi
          </h2>
          <ol className="mt-6 grid gap-px border border-border bg-border md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="bg-white p-6">
                <span className="label text-accent">0{i + 1}</span>
                <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 border border-border p-4">
            <ol className="flex flex-wrap items-center gap-2" aria-label="Tijek jedne recenzije">
              {FLOW.map((s, i, a) => (
                <li key={s} className="flex items-center gap-2">
                  <span
                    className={
                      "label whitespace-nowrap border px-3 py-2 " +
                      (i === 0 ? "border-foreground bg-foreground text-white" : i === a.length - 1 ? "border-orange bg-orange text-black" : "border-border-strong")
                    }
                  >
                    {s}
                  </span>
                  {i < a.length - 1 && <ArrowRight className="size-4 shrink-0 text-subtle" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Što radite vi */}
        <section className="border-t border-border py-12" aria-labelledby="vi">
          <h2 id="vi" className="label flex items-center gap-2 text-muted">
            <span className="size-1.5 bg-orange" /> Što radite vi
          </h2>
          <p className="mt-4 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Samo nam javite kad je posao gotov. Bez aplikacije.</p>
          <div className="mt-8 grid gap-px border border-border bg-border md:grid-cols-3">
            {HOW_YOU_REPORT.map((s) => (
              <div key={s.title} className="bg-white p-6">
                <h3 className="font-bold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl border-l-[3px] border-orange bg-orange-soft p-4 text-[15px] leading-relaxed">
            <strong>Pošteno o SMS-ovima:</strong> poruke šaljemo s našeg NOVO broja ili oznake pošiljatelja, ne s vašeg. U svakoj piše ime vaše tvrtke i potpisana je njome, pa klijent odmah zna
            od koga je. Odjava je moguća poveznicom u poruci ili, gdje mreža dopušta odgovore, odgovorom STOP, i poštuje se automatski.
          </p>
        </section>

        {/* Primjer izvještaja */}
        <section className="border-t border-border py-12" aria-labelledby="izvjestaj">
          <h2 id="izvjestaj" className="label flex items-center gap-2 text-muted">
            <span className="size-1.5 bg-orange" /> Što vidite vi
          </h2>
          <div className="mt-4 grid items-start gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="min-w-0">
              <p className="max-w-xl text-2xl font-bold leading-tight sm:text-3xl">Jednom tjedno kratak izvještaj na email. Bez prijave, bez aplikacije.</p>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
                Svaki ponedjeljak dobijete pregled zadnjih sedam dana: koliko je zahtjeva poslano, koliko ih je kliknulo i koliko je stiglo novih recenzija. Ako tjedan prođe mirno, piše i to, bez
                ukrašavanja.
              </p>
            </div>
            <figure className="min-w-0 border border-border bg-white p-5" aria-label="Primjer tjednog izvještaja s izmišljenim podacima">
              <p className="label flex flex-wrap items-center justify-between gap-2 text-muted">
                <span>NOVO Recenzije · Tjedni izvještaj</span>
                <span className="border border-border-strong px-2 py-0.5 text-[11px]">Primjer</span>
              </p>
              <p className="mt-3 text-lg font-bold">Klima Servis Horvat</p>
              <dl className="mt-3 divide-y divide-border border-t border-border">
                {SAMPLE_REPORT.map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="min-w-0 text-sm text-muted">{label}</dt>
                    <dd className="tabular shrink-0 text-lg font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
              <figcaption className="mt-3 text-[12px] leading-relaxed text-muted">Izmišljeni podaci, samo za prikaz kako izvještaj izgleda.</figcaption>
            </figure>
          </div>
        </section>

        {/* Mogućnosti */}
        <section className="border-t border-border py-12" aria-labelledby="sto">
          <h2 id="sto" className="label flex items-center gap-2 text-muted">
            <span className="size-1.5 bg-orange" /> Što dobivate
          </h2>
          <p className="mt-4 max-w-2xl text-2xl font-bold leading-tight sm:text-3xl">Sve između „posao gotov” i „5 zvjezdica”.</p>
          <div className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white p-6">
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {INDUSTRIES.map((i) => (
              <span key={i} className="label rounded-full border border-border-strong px-3 py-1.5 text-muted">
                {i}
              </span>
            ))}
          </div>
        </section>

        {/* Cijene */}
        <section className="border-t border-border py-12" aria-labelledby="cijene-naslov" id="cijene">
          <h2 id="cijene-naslov" className="label flex items-center gap-2 text-muted">
            <span className="size-1.5 bg-orange" /> Cijene
          </h2>
          <p className="mt-4 text-[15px] text-muted">Cijene su mjesečne i bez PDV-a. Otkaz bilo kad, bez ugovorne obveze.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {plans.map((p) => {
              const featured = p.key === "growth";
              return (
                <div key={p.id} className={"flex flex-col border bg-white p-6 " + (featured ? "border-foreground" : "border-border")}>
                  <div className="flex items-center justify-between">
                    <h3 className="label">{p.name}</h3>
                    {featured && <span className="label rounded-full bg-orange px-2.5 py-1 text-black">Najpopularniji</span>}
                  </div>
                  <p className="mt-4">
                    <span className="tabular text-4xl font-bold text-accent">{formatEur(p.priceMonthlyCents)}</span>
                    <span className="text-muted"> / mj</span>
                  </p>
                  <p className="mt-2 text-sm text-muted">{p.description}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    {planPoints(p).map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-orange" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-6" variant={featured ? "primary" : "secondary"}>
                    <Link href={`/recenzije?paket=${p.key}#upit`}>Pošaljite upit</Link>
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-sm">
            Imate i fizičku pločicu?{" "}
            <Link href="/proizvodi" className="font-bold underline underline-offset-4">
              NFC pločica za Google recenzije
            </Link>{" "}
            savršeno ide uz ovo: klijent prisloni mobitel na pultu, a SMS pokrije sve ostale.
          </p>
        </section>

        {/* FAQ */}
        <section className="border-t border-border py-12" aria-labelledby="faq">
          <h2 id="faq" className="label flex items-center gap-2 text-muted">
            <span className="size-1.5 bg-orange" /> Česta pitanja
          </h2>
          <div className="mt-6 border-t border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-border py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                  {f.q}
                  <span className="text-xl text-orange transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Upit */}
        <section className="scroll-mt-6 border-t border-border py-14" aria-labelledby="upit-naslov" id="upit">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0">
              <h2 id="upit-naslov" className="label flex items-center gap-2 text-muted">
                <span className="size-1.5 bg-orange" /> Upit
              </h2>
              <p className="mt-4 max-w-xl text-2xl font-bold leading-tight sm:text-3xl">Vaš sljedeći posao može biti vaša sljedeća recenzija s 5 zvjezdica.</p>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
                Ostavite kontakt i naziv tvrtke. Javljamo se unutar 24 sata, a sve ostalo preuzimamo mi.
              </p>
              <div className="mt-8 max-w-xl">
                <RecenzijeInquiryForm
                  key={defaultPlan ?? "none"}
                  plans={plans.map((p) => ({ key: p.key, label: `${p.name} · ${formatEur(p.priceMonthlyCents)} / mj bez PDV-a` }))}
                  defaultPlan={defaultPlan}
                />
              </div>
            </div>
            <aside className="min-w-0 self-start border border-border p-6">
              <p className="label text-muted">Radije razgovor?</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">Javite nam se izravno, odgovaramo brzo.</p>
              <ul className="mt-5 space-y-3 text-[15px]">
                <li>
                  <a href={mailHref} className="break-all font-bold underline underline-offset-4">
                    {contact.contactEmail}
                  </a>
                </li>
                {waHref && (
                  <li>
                    <a href={waHref} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">
                      Pišite na WhatsApp
                    </a>
                  </li>
                )}
                {phoneHref && contact.phone && (
                  <li>
                    <a href={phoneHref} className="font-bold underline underline-offset-4">
                      {contact.phone}
                    </a>
                  </li>
                )}
              </ul>
            </aside>
          </div>
        </section>
      </div>
    </NovoShell>
  );
}

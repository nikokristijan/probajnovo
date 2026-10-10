import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Phone } from "lucide-react";
import NovoShell from "@/components/novo/NovoShell";
import LegalFooterLinks from "@/components/LegalFooterLinks";
import { Button } from "@/components/recenzije/ui/button";
import { DigitalniJelovnikInquiryForm } from "@/components/digitalni-jelovnik/inquiry-form";
import { GatePhone, MenuPhone, QrGlyph } from "@/components/digitalni-jelovnik/phones";
import { getAgencyContact } from "@/lib/novoHomeData";
import { telHref, whatsappUrl } from "@/lib/phone";
import {
  ANNUAL_PAID_MONTHS,
  HOSPITALITY_PLANS,
  SETUP_FEE_EUR,
  annualPriceEur,
  findHospitalityPlan,
  formatEur,
} from "@/lib/hospitality-plans";

export const dynamic = "force-dynamic";

const BASE_URL = "https://www.probajnovo.com";
const PAGE_URL = `${BASE_URL}/digitalni-jelovnik`;
const CHEAPEST = Math.min(...HOSPITALITY_PLANS.map((p) => p.priceMonthlyEur));

const TITLE = "Digitalni jelovnik za kafiće i restorane – NOVO";
const DESCRIPTION = `QR jelovnik za kafiće i restorane. Mi unesemo jelovnik, tiskamo stalke i mijenjamo cijene na vaš poziv, a gost po želji dobije molbu za Google recenziju. Od ${formatEur(CHEAPEST)} mjesečno, bez PDV-a.`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "NOVO",
    locale: "hr_HR",
    type: "website",
    images: [{ url: "/novo-logo.png", width: 1474, height: 497 }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/novo-logo.png"] },
};

const GUEST_STEPS = [
  {
    title: "Gost skenira QR kod",
    text: "Mobitelom skenira kod na stolu ili na vratima. Ne treba mu aplikacija, račun ni vaš Wi-Fi.",
  },
  {
    title: "Otvara se jelovnik",
    text: "Jelovnik se otvara na našoj stranici, uredno složen za mobitel. Gost može upisati broj mobitela uz privolu, ali ne mora: jelovnik se može otvoriti i bez broja.",
  },
  {
    title: "Nakon posjeta stiže jedna poruka",
    text: "Samo gostu koji je ostavio broj i pristao, otprilike sat i pol nakon posjeta stiže jedna SMS poruka s molbom za Google recenziju. Paket Jelovnik ne šalje poruke.",
  },
];

const FEATURES = [
  {
    title: "Jelovnik na našoj stranici",
    text: "Vaš jelovnik živi na probajnovo.com, čitak na svakom mobitelu. Ne trebate vlastitu web stranicu ni domenu.",
  },
  {
    title: "Tiskani stalci i naljepnica",
    text: "Dobivate tiskane stolne stalke s QR kodom (jedan komplet) i naljepnicu za vrata. Stižu gotovi, vi ih samo postavite. NFC pločicu možemo dodati po dogovoru.",
  },
  {
    title: "Izmjene cijena na poziv",
    text: "Nova cijena kave? Nazovite ili pošaljite SMS ili WhatsApp. Mi izmijenimo jelovnik, a gosti uvijek vide aktualne cijene, bez novog tiska.",
  },
  {
    title: "Prijevodi",
    text: "Engleski prijevod je u svakom paketu, njemački i talijanski u paketu Plus. Gost jednim dodirom bira jezik.",
  },
  {
    title: "Tjedni izvještaj",
    text: "U paketima s recenzijama jednom tjedno dobivate kratak izvještaj u jednoj rečenici, bez tablica i grafikona.",
  },
  {
    title: "Tipke Ocijeni nas, Wi-Fi, Kontakt",
    text: "Ocijeni nas vodi gosta na vašu Google stranicu, Wi-Fi pokazuje podatke vaše mreže, a Kontakt vaš broj. Uključujemo samo one koje želite.",
  },
];

const WE_DO = [
  {
    title: "Fotografirajte jelovnik",
    text: "Pošaljite nam fotografiju ili sken papirnatog jelovnika, ili PDF. Mi ga prepišemo u digitalni oblik i prije objave vam ga pokažemo na provjeru.",
  },
  {
    title: "Javite izmjenu kako vam je lakše",
    text: "SMS, WhatsApp ili poziv, npr. „od sutra kava 1,80”. Mi to promijenimo.",
  },
  {
    title: "Mi postavimo i isprintamo",
    text: "Stolni stalci i naljepnica za vrata stižu isprintani. Vi ih samo stavite na stolove i vrata.",
  },
  {
    title: "Podrška na hrvatskom",
    text: "Kad god nešto niste sigurni, nazovite ili napišite nam. Odgovara vam netko iz NOVO-a, na hrvatskom.",
  },
];

const HONEST = [
  {
    title: "Gost odlučuje",
    text: "Broj upisuje sam i kvačicom potvrđuje privolu. Bez privole ne šaljemo ništa. Jelovnik može pogledati i bez broja.",
  },
  {
    title: "Privola u dva sloja",
    text: "Kratka rečenica uz kvačicu kaže tko šalje i što. „Pročitaj više” objašnjava ostalo: kada stiže poruka, noćnu pauzu, rok čuvanja i odjavu.",
  },
  {
    title: "STOP u svakoj poruci",
    text: "Odgovor STOP (ili poveznica u poruci) i gost više ne dobiva poruke ni od jednog lokala.",
  },
  {
    title: "Brojevi najviše 12 mjeseci",
    text: "Broj gosta čuvamo najviše 12 mjeseci i koristimo samo za poruke na koje je gost pristao.",
  },
  {
    title: "Podatke ne prodajemo",
    text: "Brojeve gostiju ne prodajemo i ne koristimo za vlastito oglašavanje. Postupamo prema GDPR-u.",
  },
  {
    title: "Bez obećanja o rezultatima",
    text: "Ne možemo reći koliko će gostiju ostaviti recenziju. Ne lažiramo recenzije i ne šaljemo molbu samo zadovoljnima.",
  },
];

const FAQ = [
  {
    q: "Tko mijenja jelovnik?",
    a: "Mi. Javite nam izmjenu pozivom, SMS-om ili WhatsAppom (npr. nova cijena ili novo jelo) i mi je upišemo. Ne morate se nigdje prijavljivati ni ništa učiti.",
  },
  {
    q: "Što ako nemam internet na stolu?",
    a: "Gostu ne treba vaš Wi-Fi, dovoljan je njegov mobilni internet. Ako negdje u lokalu nema signala, preporučujemo da uz QR kod zadržite i papirnati jelovnik kao rezervu.",
  },
  {
    q: "Moraju li gosti ostaviti broj? I što ako ne žele poruke?",
    a: "Ne moraju. Ispod polja za broj je poveznica za pregled jelovnika bez broja, a tada ništa ne spremamo i ne šaljemo. Gost koji je ostavio broj može se u svakom trenutku odjaviti odgovorom STOP i više ne dobiva poruke.",
  },
  {
    q: "Je li to zakonito?",
    a: "Da, kad se radi ispravno, a tako radimo: gost sam upiše broj i dobrovoljno potvrdi privolu, tekst privole točno kaže što dobiva, u svakoj poruci je odjava, a broj čuvamo najviše 12 mjeseci. Ne šaljemo nikome tko nije pristao. Ovo nije pravni savjet; za svoj lokal pitajte i svog knjigovođu ili pravnika.",
  },
  {
    q: "Koliko poruka gost dobiva?",
    a: "Zadano jednu: molbu za Google recenziju, otprilike sat i pol nakon posjeta (noću, od 22:00 do 9:00, ne šaljemo, pa tada stiže ujutro). Istom gostu ne šaljemo novi zahtjev unutar 30 dana. Povremene obavijesti o novostima, događanjima i ponudama šaljemo samo u paketu Plus, samo ako ih uključite i samo gostima koji su na njih izričito pristali.",
  },
  {
    q: "Kako otkazati?",
    a: "Bilo kad, bez ugovorne obveze: javite nam i otkaz vrijedi do kraja tekućeg mjeseca.",
  },
  {
    q: "Čiji su podaci gostiju i tko ih vidi?",
    a: "Brojeve čuvamo mi, najviše 12 mjeseci, i koristimo ih samo za poruke koje je gost odobrio. Ne prodajemo ih i ne koristimo za vlastito oglašavanje. Pojedinosti o obradi podataka navedene su u politici privatnosti.",
  },
  {
    q: "Mogu li koristiti vlastiti jelovnik ili PDF?",
    a: "Da. Ako već imate jelovnik kao PDF ili stranicu, QR kod i ulaz ostaju isti, a gost jednim dodirom otvara vaš jelovnik. Preporučujemo ipak naš unos: bolje se čita na mobitelu, a cijene mijenjamo bez ponovnog slanja datoteke.",
  },
  {
    q: "Imam goste iz inozemstva. Je li jelovnik na više jezika?",
    a: "Da. Engleski prijevod je uključen u svaki paket, a njemački i talijanski u paketu Plus. Gost jezik bira jednim dodirom.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="label flex items-center gap-2 text-muted">
      <span className="size-2 bg-orange" aria-hidden /> {children}
    </p>
  );
}

const H2 = "mt-4 max-w-3xl text-[30px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[40px]";
const LEAD = "mt-4 max-w-2xl text-[18px] leading-relaxed text-ink-soft";

export default async function DigitalniJelovnikPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [contact, sp] = await Promise.all([getAgencyContact(), searchParams]);
  const defaultPlan = findHospitalityPlan(sp.paket)?.key;

  const waHref = contact.phone ? whatsappUrl(contact.phone, "Pozdrav! Zanima me NOVO digitalni jelovnik za moj lokal.") : null;
  const phoneHref = contact.phone ? telHref(contact.phone) : null;
  const mailHref = `mailto:${contact.contactEmail}?subject=${encodeURIComponent("NOVO digitalni jelovnik")}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Digitalni jelovnik za kafiće i restorane",
      serviceType: "Digitalni jelovnik s QR kodom",
      description:
        "NOVO za kafić ili restoran izrađuje digitalni jelovnik na QR kodu, mijenja cijene na zahtjev, isporučuje tiskane stolne stalke i naljepnicu za vrata, a po želji gostu uz privolu šalje molbu za Google recenziju.",
      url: PAGE_URL,
      provider: { "@type": "Organization", name: "NOVO", url: BASE_URL },
      areaServed: { "@type": "Country", name: "Hrvatska" },
      offers: HOSPITALITY_PLANS.map((p) => {
        const price = p.priceMonthlyEur.toFixed(2);
        return {
          "@type": "Offer",
          name: p.name,
          description: p.summary,
          price,
          priceCurrency: "EUR",
          url: `${PAGE_URL}?paket=${p.key}`,
          priceSpecification: { "@type": "UnitPriceSpecification", price, priceCurrency: "EUR", unitCode: "MON", valueAddedTaxIncluded: false },
        };
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Proizvodi", item: `${BASE_URL}/proizvodi` },
        { "@type": "ListItem", position: 2, name: "Digitalni jelovnik", item: PAGE_URL },
      ],
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
          <Link href="/proizvodi" className="inline-flex min-h-11 items-center text-foreground hover:underline">
            ← Proizvodi
          </Link>
          <span aria-hidden>/</span>
          <span>Digitalni jelovnik</span>
        </div>

        {/* Hero */}
        <section className="grid items-center gap-12 pb-12 pt-4 lg:grid-cols-[1.1fr_0.9fr] lg:pb-16 lg:pt-8">
          <div className="min-w-0">
            <p className="label flex items-center gap-2 text-ink-soft">
              <span className="size-2 bg-orange" aria-hidden /> Novo · usluga za kafiće i restorane
            </p>
            <h1 className="mt-5 text-[40px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[58px]">Digitalni jelovnik za kafiće i restorane</h1>
            <p className="mt-6 max-w-xl text-[20px] leading-relaxed text-ink-soft">
              Gost skenira QR kod na stolu i na mobitelu otvara vaš jelovnik. Mi ga unesemo, isprintamo stalke za stolove i mijenjamo cijene kad nam javite.{" "}
              <strong className="text-foreground">Vi ne radite ništa.</strong>
            </p>
            <p className="mt-7 text-3xl font-bold">
              od {formatEur(CHEAPEST)} <span className="text-lg font-normal text-muted">/ mjesec, bez PDV-a</span>
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button size="lg" asChild className="h-14 px-8 text-[14px]">
                <a href="#upit">
                  Pošaljite upit <ArrowRight />
                </a>
              </Button>
              {phoneHref && contact.phone && (
                <a href={phoneHref} className="inline-flex min-h-11 items-center gap-2 text-[18px] font-bold underline underline-offset-4">
                  <Phone className="size-5" aria-hidden /> {contact.phone}
                </a>
              )}
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[16px] text-ink-soft">
              {["Bez aplikacije i prijave", "Otkaz bilo kad", "Podrška na hrvatskom"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <Check className="size-4 text-orange" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>

          <figure className="relative mx-auto w-full max-w-[340px] min-w-0 lg:mx-0 lg:justify-self-center">
            <MenuPhone />
            <div
              className="absolute -bottom-5 -left-1 hidden w-[132px] rotate-[-4deg] border border-foreground bg-white p-2.5 shadow-[6px_6px_0_0_rgb(0_0_0/0.9)] sm:block lg:-left-14"
              aria-hidden="true"
            >
              <QrGlyph className="block w-full" />
              <p className="label mt-2 text-center text-[10px] leading-snug">Skenirajte i pogledajte jelovnik</p>
            </div>
            <figcaption className="mt-9 text-center text-[15px] leading-relaxed text-muted">
              Primjer kako jelovnik izgleda na mobitelu. Lokal i cijene su izmišljeni.
            </figcaption>
          </figure>
        </section>

        {/* Kako izgleda za goste */}
        <section className="border-t border-border py-14" aria-labelledby="kako">
          <Eyebrow>Kako izgleda za goste</Eyebrow>
          <h2 id="kako" className={H2}>
            Tri koraka za gosta, bez ikakve aplikacije
          </h2>
          <div className="mt-9 grid items-start gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <ol className="min-w-0 border border-border">
              {GUEST_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-5 border-b border-border p-6 last:border-b-0">
                  <span className="grid size-11 shrink-0 place-items-center bg-orange text-[20px] font-bold text-black" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[22px] font-bold leading-snug">
                      <span className="sr-only">Korak {i + 1}: </span>
                      {s.title}
                    </h3>
                    <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <figure className="mx-auto w-full max-w-[340px] min-w-0">
              <GatePhone />
              <figcaption className="mt-5 text-center text-[15px] leading-relaxed text-muted">
                Ulazni prozor nakon skeniranja: broj je moguć, ali jelovnik se otvara i bez njega.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Što dobivate */}
        <section className="border-t border-border py-14" aria-labelledby="dobivate">
          <Eyebrow>Što dobivate</Eyebrow>
          <h2 id="dobivate" className={H2}>
            Sve što lokalu treba za jelovnik na QR kodu
          </h2>
          <ul className="mt-9 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="bg-white p-6">
                <h3 className="text-[20px] font-bold leading-snug">{f.title}</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{f.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Mi radimo sve, vi ništa */}
        <section className="border-t border-border py-14" aria-labelledby="mi-radimo">
          <Eyebrow>Mi radimo sve, vi ništa</Eyebrow>
          <h2 id="mi-radimo" className={H2}>
            Nema ničega što morate naučiti
          </h2>
          <p className={LEAD}>Vlasnici lokala nemaju vremena za nove programe, pa ih ni ne tražimo. Nema prijave, aplikacije ni postavki. Sve rješavamo mi.</p>
          <ol className="mt-9 grid gap-px border border-border bg-border md:grid-cols-2">
            {WE_DO.map((s, i) => (
              <li key={s.title} className="bg-white p-6">
                <span className="label text-ink-soft">0{i + 1}</span>
                <h3 className="mt-3 text-[22px] font-bold leading-snug">{s.title}</h3>
                <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-3xl border-l-[3px] border-orange bg-orange-soft p-5 text-[18px] leading-relaxed">
            <strong>Što radite vi?</strong> Javite nam kad se nešto promijeni. To je cijeli vaš posao.
          </p>
        </section>

        {/* Pošteno o brojevima i privolama */}
        <section className="border-t border-border py-14" aria-labelledby="posteno">
          <Eyebrow>Pošteno o brojevima i privolama</Eyebrow>
          <h2 id="posteno" className={H2}>
            Gost odlučuje, a mi poštujemo njegov izbor
          </h2>
          <div className="mt-9 grid items-start gap-8 lg:grid-cols-[1.25fr_0.75fr]">
            <ul className="grid min-w-0 gap-px border border-border bg-border sm:grid-cols-2">
              {HONEST.map((h) => (
                <li key={h.title} className="bg-white p-6">
                  <h3 className="text-[20px] font-bold leading-snug">{h.title}</h3>
                  <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{h.text}</p>
                </li>
              ))}
            </ul>
            <figure className="min-w-0 border border-border bg-white p-5" aria-label="Primjer poruke gostu">
              <p className="label flex flex-wrap items-center justify-between gap-2 text-muted">
                <span>Poruka gostu</span>
                <span className="border border-border-strong px-2 py-0.5 text-[12px]">Primjer</span>
              </p>
              <p className="mt-4 break-words text-[17px] leading-relaxed">
                Hvala sto ste svratili u [naziv lokala]! Ako vam je bilo lijepo, ostavite nam kratku Google recenziju: probajnovo.com/r/k3Fq9xLm2a Za odjavu napisite STOP.
              </p>
              <figcaption className="mt-4 text-[15px] leading-relaxed text-muted">
                Samo primjer teksta. Ime gosta ne znamo, pa ga poruka ne spominje.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Cijene */}
        <section className="scroll-mt-6 border-t border-border py-14" aria-labelledby="cijene" id="cijene">
          <Eyebrow>Cijene</Eyebrow>
          <h2 id="cijene" className={H2}>
            Jasne mjesečne cijene
          </h2>
          <p className={LEAD}>Cijene su mjesečne i bez PDV-a. Otkaz bilo kad, bez ugovorne obveze.</p>
          <div className="mt-9 grid gap-5 lg:grid-cols-3">
            {HOSPITALITY_PLANS.map((p) => {
              const featured = p.badge != null;
              return (
                <div key={p.key} className={"flex min-w-0 flex-col border bg-white p-6 " + (featured ? "border-2 border-foreground" : "border-border")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="label text-[14px] text-foreground">{p.name}</h3>
                    {p.badge && <span className="label rounded-full bg-orange px-3 py-1 text-black">{p.badge}</span>}
                  </div>
                  <p className="mt-5">
                    <span className="tabular text-[46px] font-bold leading-none">{formatEur(p.priceMonthlyEur)}</span>
                    <span className="text-[17px] text-muted"> / mj bez PDV-a</span>
                  </p>
                  <p className="mt-3 text-[16px] text-ink-soft">
                    Godišnje {formatEur(annualPriceEur(p.priceMonthlyEur))}, plaća se {ANNUAL_PAID_MONTHS} mjeseci umjesto 12.
                  </p>
                  <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">{p.summary}</p>
                  <ul className="mt-5 flex-1 space-y-3 text-[17px] leading-snug">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-3">
                        <Check className="mt-1 size-5 shrink-0 text-orange" aria-hidden /> <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-7 h-14 text-[14px]" variant={featured ? "primary" : "secondary"}>
                    <Link href={`/digitalni-jelovnik?paket=${p.key}#upit`} aria-label={`Pošaljite upit za paket ${p.name}`}>
                      Pošaljite upit
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-5 border border-border bg-surface-2 p-6">
            <p className="label text-ink-soft">Jednokratno postavljanje</p>
            <p className="mt-3 text-[18px] leading-relaxed">
              <strong className="tabular text-[26px]">{formatEur(SETUP_FEE_EUR)}</strong> bez PDV-a. Uključuje tisak stalaka, naljepnicu za vrata i unos jelovnika s fotografije. Uz godišnju uplatu postavljanje ne naplaćujemo.
            </p>
          </div>
          <ul className="mt-6 max-w-3xl list-disc space-y-2 pl-6 text-[17px] leading-relaxed text-ink-soft marker:text-orange">
            <li>Sve cijene su bez PDV-a.</li>
            <li>Otkaz je moguć bilo kad, bez ugovorne obveze; vrijedi do kraja tekućeg mjeseca.</li>
            <li>SMS poruke su uključene u paket do navedenog broja.</li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="border-t border-border py-14" aria-labelledby="pitanja">
          <Eyebrow>Česta pitanja</Eyebrow>
          <h2 id="pitanja" className={H2}>
            Odgovori na ono što vlasnici najčešće pitaju
          </h2>
          <div className="mt-8 border-t border-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-border">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-[19px] font-bold leading-snug [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span className="grid size-8 shrink-0 place-items-center text-[28px] leading-none text-orange transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="max-w-3xl pb-5 text-[17px] leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Upit */}
        <section className="scroll-mt-6 border-t border-border py-14" aria-labelledby="upit-naslov" id="upit">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="min-w-0">
              <Eyebrow>Upit</Eyebrow>
              <h2 id="upit-naslov" className={H2}>
                Pošaljite upit, ostalo preuzimamo mi
              </h2>
              <p className={LEAD}>Ostavite kontakt i naziv lokala. Javljamo se unutar 24 sata i dogovaramo jelovnik.</p>
              <div className="mt-8 max-w-xl">
                <DigitalniJelovnikInquiryForm
                  key={defaultPlan ?? "none"}
                  plans={HOSPITALITY_PLANS.map((p) => ({ key: p.key, label: `${p.name} · ${formatEur(p.priceMonthlyEur)} / mj bez PDV-a` }))}
                  defaultPlan={defaultPlan}
                />
              </div>
            </div>
            <aside className="min-w-0 self-start border border-border p-6">
              <p className="label text-ink-soft">Radije razgovor?</p>
              <p className="mt-3 text-[17px] leading-relaxed text-ink-soft">Nazovite ili napišite nam, odgovaramo brzo.</p>
              <ul className="mt-5 space-y-2 text-[18px]">
                {phoneHref && contact.phone && (
                  <li>
                    <a href={phoneHref} className="inline-flex min-h-11 items-center font-bold underline underline-offset-4">
                      {contact.phone}
                    </a>
                  </li>
                )}
                {waHref && (
                  <li>
                    <a href={waHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center font-bold underline underline-offset-4">
                      Pišite na WhatsApp
                    </a>
                  </li>
                )}
                <li>
                  <a href={mailHref} className="inline-flex min-h-11 items-center break-all font-bold underline underline-offset-4">
                    {contact.contactEmail}
                  </a>
                </li>
              </ul>
            </aside>
          </div>
        </section>

        <p className="border-t border-border pt-8 text-[16px] leading-relaxed text-ink-soft">
          Imate obrt ili tvrtku, a ne lokal?{" "}
          <Link href="/recenzije" className="inline-flex min-h-11 items-center font-bold text-foreground underline underline-offset-4">
            Pogledajte NOVO Recenzije
          </Link>
          .
        </p>
        <LegalFooterLinks />
      </div>
    </NovoShell>
  );
}

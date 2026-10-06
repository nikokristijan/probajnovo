import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import NovoShell from "@/components/novo/NovoShell";
import { PhoneMockup } from "@/components/recenzije/phone";
import { Button } from "@/components/recenzije/ui/button";
import { demoLoginAction } from "@/lib/recenzije/actions/auth";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { env } from "@/lib/recenzije/env";
import { formatEur } from "@/lib/recenzije/status";
import { listPlans } from "@/lib/recenzije/services/billing";
import { getAgencyContact } from "@/lib/novoHomeData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Google recenzije na autopilotu – NOVO" },
  description:
    "Nakon svakog posla klijent dobije SMS s linkom za Google recenziju. Praćenje klikova, podsjetnici i pregled svih recenzija na jednom mjestu. 14 dana besplatno.",
  alternates: { canonical: "https://www.probajnovo.com/recenzije" },
};

const STEPS = [
  { title: "Završite posao", text: "Označite uslugu završenom ili dodajte klijenta u 10 sekundi. To je sve što vi radite." },
  { title: "Mi šaljemo zahtjev", text: "Klijent dobije osobni SMS s vašeg broja i linkom. Ako ne klikne, sutra stiže nenametljiv podsjetnik." },
  { title: "Klijent ostavlja recenziju", text: "Jedan dodir otvara vašu Google stranicu za recenziju. Vi vidite tko je kliknuo i tko je ocijenio." },
];

const FEATURES = [
  { title: "Praćeni linkovi", text: "Svaki klijent dobije svoj kratki link, pa točno znate tko je kliknuo i kada." },
  { title: "Automatski podsjetnici", text: "Čekaj, provjeri, podsjeti. Tijek staje čim stigne recenzija." },
  { title: "SMS s vašeg broja", text: "Spojite stari Android mobitel i poruke idu s vašeg broja, po cijeni vaše tarife." },
  { title: "AI piše poruke", text: "Claude piše tople, kratke poruke na hrvatskom, prilagođene poslu i serviseru." },
  { title: "Analitika", text: "Lijevak, klikovi i konverzija po kampanji, serviseru i usluzi. Bez nagađanja." },
  { title: "Pošteno", text: "Ne lažiramo recenzije ni podatke, i ne skrivamo loše ocjene. Odjava STOP poštuje se automatski." },
];

const FAQ = [
  {
    q: "Trebam li nešto instalirati?",
    a: "Ne nužno. Najjeftinije je spojiti stari Android mobitel s vašim SIM-om (besplatna aplikacija), pa poruke idu s vašeg broja. Bez mobitela šaljemo preko Twilija.",
  },
  {
    q: "Kako znate da je klijent ostavio recenziju?",
    a: "Klik na link pratimo točno. Recenziju povezujemo s klijentom kad se ime na Googleu poklapa, ili je vi označite jednim klikom. Google ne otkriva tko je napisao recenziju, pa ništa ne izmišljamo.",
  },
  {
    q: "Šaljete li link samo zadovoljnim klijentima?",
    a: "Ne. Googleova pravila zabranjuju filtriranje samo na pozitivne recenzije, pa svi klijenti dobiju isti link. Dobra usluga i redovito pitanje rade ostalo.",
  },
  { q: "Mogu li otkazati?", a: "Da, bilo kad. Plaća se mjesečno, bez ugovorne obveze." },
];

const INDUSTRIES = ["Klime i grijanje", "Vodoinstalateri", "Električari", "Stomatolozi", "Frizeri i saloni", "Autoservisi", "Čišćenje", "Restorani", "Apartmani"];

export default async function RecenzijeLanding() {
  await ensureReviewsDb();
  const [plans, contact] = await Promise.all([listPlans(), getAgencyContact()]);
  const cheapest = plans[0]?.priceMonthlyCents;

  const demo = env.demoEnabled ? (
    <form action={demoLoginAction}>
      <Button type="submit" size="lg" variant="secondary">
        Pogledaj demo
      </Button>
    </form>
  ) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NOVO Recenzije",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: plans.map((p) => ({ "@type": "Offer", name: p.name, price: (p.priceMonthlyCents / 100).toFixed(2), priceCurrency: "EUR" })),
  };

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
          <Link href="/recenzije/prijava" className="ml-auto text-foreground underline underline-offset-4">
            Prijava ↗
          </Link>
        </div>

        {/* Hero */}
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-14">
          <div className="min-w-0">
            <p className="label flex items-center gap-2 text-accent">
              <span className="size-1.5 bg-orange" /> Novo · softver za obrte i tvrtke
            </p>
            <h1 className="mt-5 text-[38px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[54px]">
              Svaki zadovoljan klijent postaje Google recenzija.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">
              Automatski zahtjev za recenziju nakon svakog posla, podsjetnik kad klijent zaboravi i rast ugleda, bez dodatnog posla za vas.
            </p>
            {cheapest != null && (
              <p className="mt-6 text-2xl font-bold text-accent">
                od {formatEur(cheapest)} <span className="text-base font-normal text-muted">/ mjesec</span>
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2">
              <Button size="lg" asChild>
                <Link href="/recenzije/registracija">
                  Započni besplatno <ArrowRight />
                </Link>
              </Button>
              {demo}
            </div>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              {["14 dana besplatno", "Bez kartice", "SMS s vašeg broja"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-accent" /> {t}
                </span>
              ))}
            </p>
          </div>
          <div className="relative mx-auto w-full max-w-[320px]">
            <PhoneMockup
              sender="Klima Servis Horvat"
              messages={[
                { text: "Bok Ivana! Hvala sto ste odabrali Klima Servis Horvat. Ako imate minutu, kratka Google recenzija bi nam puno znacila: probajnovo.com/r/k3Fq9xLm2a", time: "Danas 14:32" },
                { text: "Ostavila sam 5 zvjezdica 👍", from: "client" },
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
            <ol className="flex flex-wrap items-center gap-2" aria-label="Tijek automatizacije">
              {["Usluga završena", "Čekaj 10 min", "SMS zahtjev", "Kliknuo?", "Čekaj 1 dan", "Podsjetnik", "Recenzija"].map((s, i, a) => (
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
        <section className="border-t border-border py-12" aria-labelledby="cijene" id="cijene">
          <h2 id="cijene" className="label flex items-center gap-2 text-muted">
            <span className="size-1.5 bg-orange" /> Cijene
          </h2>
          <p className="mt-4 text-[15px] text-muted">14 dana besplatno. Paket birate kad ste spremni. Cijene su bez PDV-a.</p>
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
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-orange" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-6" variant={featured ? "primary" : "secondary"}>
                    <Link href="/recenzije/registracija">Probaj 14 dana</Link>
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

        <section className="border-t border-border py-14 text-center">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight">Vaš sljedeći posao može biti vaša sljedeća recenzija s 5 zvjezdica.</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Button size="lg" asChild>
              <Link href="/recenzije/registracija">
                Započni besplatno <ArrowRight />
              </Link>
            </Button>
            {demo}
          </div>
          <p className="mt-6 text-sm text-muted">
            Pitanja?{" "}
            <a href={`mailto:${contact.contactEmail}?subject=${encodeURIComponent("NOVO Recenzije")}`} className="underline underline-offset-4">
              {contact.contactEmail}
            </a>
          </p>
        </section>
      </div>
    </NovoShell>
  );
}

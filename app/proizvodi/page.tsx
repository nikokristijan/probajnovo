import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { listProducts } from "@/lib/db/queries";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Proizvodi — NOVO",
  description:
    "Fizički proizvodi NOVO studija — NFC pločice koje gosta jednim dodirom spajaju na WiFi, i prostorna slova po mjeri.",
  robots: { index: true, follow: true },
  alternates: { canonical: "https://www.probajnovo.com/proizvodi" },
  icons: { icon: "/favicon-orange.png" },
};

export default async function ProductsPage() {
  const products = (await listProducts({ onlyPublished: true })).filter((p) => p.slug);

  return (
    <div className="novo-product-page">
      <div className="novo-product-topbar">
        <Link href="/" className="novo-product-logo">NOVO</Link>
        <Link href="/" className="novo-product-back">← NASLOVNICA</Link>
      </div>
      <div className="novo-product-wrap">
        <div className="novo-products-header">
          <span className="novo-products-kicker">PROIZVODI</span>
          <h1>Fizički proizvodi NOVO studija</h1>
          <p className="novo-products-lede">
            Od pločica s NFC oznakom koje goste jednim dodirom spajaju na WiFi, do prostornih slova po
            mjeri za izlog ili recepciju.
          </p>
        </div>

        <div className="novo-products-grid">
          {/* Statična kartica za /slova konfigurator — nije u `products` tablici jer
              nije jednostavna tekst/slika+upit stranica kao ostali proizvodi, nego
              zaseban interaktivni alat (vidi app/slova). Uvijek prikazana prva. */}
          <Link href="/slova" className="novo-product-card">
            <span className="novo-product-card-badge">NOVO</span>
            <div className="novo-product-card-img" style={{ background: "#0b0b10" }} />
            <div className="novo-product-card-body">
              <span className="novo-product-card-category">Prostorna slova</span>
              <span className="novo-product-card-name">Custom slova po mjeri</span>
              <span className="novo-product-card-tagline">
                Odaberite font, veličinu i boju, pogledajte uživo i pošaljite upit.
              </span>
              <span className="novo-product-card-price">od 4 €/slovo</span>
            </div>
          </Link>

          {products.map((p) => (
            <Link key={p.id} href={`/proizvodi/${p.slug}`} className="novo-product-card">
              {p.featured && <span className="novo-product-card-badge">ISTAKNUTO</span>}
              <div className="novo-product-card-img">
                {p.images[0] && <Image src={p.images[0]} alt={p.name} fill sizes="(max-width: 640px) 100vw, 320px" />}
              </div>
              <div className="novo-product-card-body">
                {p.category && <span className="novo-product-card-category">{p.category}</span>}
                <span className="novo-product-card-name">{p.name}</span>
                <span className="novo-product-card-tagline">{p.tagline}</span>
                <span className="novo-product-card-price">
                  {p.priceEur != null ? `od ${p.priceEur} €` : "na upit"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

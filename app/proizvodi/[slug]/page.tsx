import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, listProducts, recordPageView } from "@/lib/db/queries";
import { getAgencyContact } from "@/lib/novoHomeData";
import { todayDateStringZagreb } from "@/lib/date";
import NovoShell from "@/components/novo/NovoShell";
import ProductGalleryNovo from "@/components/novo/ProductGalleryNovo";
import ProductInquiryNovo from "@/components/novo/ProductInquiryNovo";
import ProductDescription from "@/components/novo/ProductDescription";
import ShareProductButton from "@/components/novo/ShareProductButton";
import ProductStickyCta from "@/components/novo/ProductStickyCta";

export const revalidate = 0;

const BASE_URL = "https://www.probajnovo.com";

type Params = { slug: string };

function priceLabel(priceEur: number | null) {
  return priceEur != null ? `od ${priceEur} €` : "Cijena na upit";
}

/** YouTube/Vimeo poveznica → embed adresa; datoteka (.mp4, Vercel Blob) → null (koristi <video>). */
function videoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean)[0]}`;
  } catch {}
  return null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.published) {
    return { title: "Proizvod", robots: { index: false, follow: false } };
  }
  const url = `${BASE_URL}/proizvodi/${product.slug}`;
  const description = product.seoDescription || product.tagline;
  // Layout dodaje " — NOVO"; ako je SEO naslov već sadrži, ne ponavljamo.
  const title = product.seoTitle
    ? /novo/i.test(product.seoTitle)
      ? { absolute: product.seoTitle }
      : product.seoTitle
    : product.name;
  const ogTitle = typeof title === "string" ? `${title} — NOVO` : title.absolute;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title: ogTitle,
      description,
      url,
      type: "website",
      images: product.images[0] ? [{ url: product.images[0], alt: product.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const [product, all, contact] = await Promise.all([
    getProductBySlug(slug),
    listProducts({ onlyPublished: true }),
    getAgencyContact(),
  ]);
  if (!product || !product.published || !product.slug) notFound();

  // Brojač pregleda (za statistiku u /admin/products) — nikad ne ruši stranicu.
  recordPageView("product", product.id, todayDateStringZagreb()).catch((err) =>
    console.error("[ProductPage] recordPageView nije uspio:", err)
  );

  const url = `${BASE_URL}/proizvodi/${product.slug}`;
  const others = all.filter((p) => p.id !== product.id && p.slug).slice(0, 3);
  const embed = product.videoUrl ? videoEmbed(product.videoUrl) : null;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.seoDescription || product.tagline,
      image: product.images,
      url,
      brand: { "@type": "Brand", name: "NOVO" },
      ...(product.category ? { category: product.category } : {}),
      ...(product.priceEur != null
        ? {
            offers: {
              "@type": "Offer",
              url,
              price: product.priceEur,
              priceCurrency: "EUR",
              availability: "https://schema.org/MadeToOrder",
              seller: { "@type": "Organization", name: "NOVO" },
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "NOVO", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Proizvodi", item: `${BASE_URL}/proizvodi` },
        { "@type": "ListItem", position: 3, name: product.name, item: url },
      ],
    },
  ];

  return (
    <NovoShell
      active="products"
      variant="detail"
      contactEmail={contact.contactEmail}
      instagramHandle={contact.instagramHandle}
      city={contact.city}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="novo-os-panel pd">
        <div className="pd-crumbs mono">
          <Link href="/proizvodi" className="pd-crumb-link">
            ← PROIZVODI
          </Link>
          <span aria-hidden="true">/</span>
          <span className="pd-crumb-current">{product.name.toUpperCase()}</span>
        </div>

        <div className="pd-scroll">
          <article className="pd-top">
            <ProductGalleryNovo images={product.images} name={product.name} />

            <div className="pd-info">
              <div className="pd-kicker">
                <span className="novo-os-kicker mono">{(product.category || "Proizvod").toUpperCase()}</span>
                {product.featured && <span className="pl-badge pl-badge--static mono">ISTAKNUTO</span>}
              </div>
              <h1 className="pd-title">{product.name}</h1>
              <p className="pd-tagline">{product.tagline}</p>

              <div className="pd-price">
                <span className="pd-price-value">{priceLabel(product.priceEur)}</span>
                {product.priceEur != null && <span className="mono muted pd-price-unit">/ KOM</span>}
              </div>

              {product.features.length > 0 && (
                <ul className="pd-features" aria-label="Značajke">
                  {product.features.map((f) => (
                    <li key={f} className="novo-os-chip mono">
                      {f.toUpperCase()}
                    </li>
                  ))}
                </ul>
              )}

              <div className="pd-actions">
                <a href="#upit" className="novo-os-cta mono">
                  {(product.ctaButtonText?.trim() || "Pošalji upit").toUpperCase()} ↓
                </a>
                <ShareProductButton url={url} title={product.name} />
              </div>

              <ul className="pd-trust mono">
                <li>ODGOVOR UNUTAR 24 H</li>
                <li>IZRADA PO MJERI</li>
                <li>UPIT JE BESPLATAN I NE OBVEZUJE</li>
              </ul>
            </div>
          </article>

          {product.description.trim() && (
            <section className="pd-section" aria-labelledby="pd-opis">
              <h2 id="pd-opis" className="section-title">
                OPIS
              </h2>
              <ProductDescription text={product.description} />
            </section>
          )}

          {product.videoUrl && (
            <section className="pd-section" aria-labelledby="pd-video">
              <h2 id="pd-video" className="section-title">
                VIDEO
              </h2>
              <div className="pd-video">
                {embed ? (
                  <iframe
                    src={embed}
                    title={`${product.name} — video`}
                    loading="lazy"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <video src={product.videoUrl} controls playsInline preload="metadata" poster={product.images[0]} />
                )}
              </div>
            </section>
          )}

          <section className="pd-section pd-inquiry" id="upit" aria-labelledby="pd-upit">
            <div className="pd-inquiry-side">
              <h2 id="pd-upit" className="section-title">
                UPIT
              </h2>
              <p className="pd-inquiry-title">Zanima vas {product.name}?</p>
              <ol className="pd-steps">
                <li>
                  <span className="mono">01</span> Pošaljete upit s količinom.
                </li>
                <li>
                  <span className="mono">02</span> Javimo se unutar 24 h s točnom cijenom.
                </li>
                <li>
                  <span className="mono">03</span> Dogovorimo detalje i krećemo u izradu.
                </li>
              </ol>
              <p className="pd-inquiry-alt mono">
                ILI PIŠITE NA{" "}
                <a href={`mailto:${contact.contactEmail}?subject=${encodeURIComponent(`Upit — ${product.name}`)}`}>
                  {contact.contactEmail}
                </a>
              </p>
            </div>
            <ProductInquiryNovo
              productId={product.id}
              productName={product.name}
              priceEur={product.priceEur}
              ctaLabel={product.ctaButtonText}
            />
          </section>

          {others.length > 0 && (
            <section className="pd-section" aria-labelledby="pd-ostali">
              <h2 id="pd-ostali" className="section-title">
                OSTALI PROIZVODI
              </h2>
              <div className="pl-grid">
                {others.map((p) => (
                  <Link key={p.id} href={`/proizvodi/${p.slug}`} className="pl-card">
                    <div className="pl-card-img">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt={p.name} className="pl-card-thumb" loading="lazy" />
                      ) : null}
                    </div>
                    <div className="pl-card-body">
                      <span className="pl-card-cat mono">{(p.category || "Proizvod").toUpperCase()}</span>
                      <span className="pl-card-name">{p.name}</span>
                      <span className="pl-card-tagline">{p.tagline}</span>
                      <span className="pl-card-foot">
                        <span className="pl-card-price mono">{priceLabel(p.priceEur)}</span>
                        <span className="pl-card-go mono" aria-hidden="true">
                          DETALJI →
                        </span>
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <footer className="pd-legal mono">
            <Link href="/uvjeti">UVJETI</Link>
            <Link href="/povrat">POVRAT</Link>
            <Link href="/privatnost">PRIVATNOST</Link>
            <Link href="/kolacici">KOLAČIĆI</Link>
          </footer>

          {/* Mobitel: cijena i upit uvijek pri dnu ekrana. */}
          <ProductStickyCta price={priceLabel(product.priceEur)} />
        </div>
      </div>
    </NovoShell>
  );
}

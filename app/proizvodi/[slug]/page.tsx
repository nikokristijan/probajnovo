import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, listProducts, recordPageView } from "@/lib/db/queries";
import { getAgencyContact } from "@/lib/novoHomeData";
import { todayDateStringZagreb } from "@/lib/date";
import NovoShell from "@/components/novo/NovoShell";
import ProductGalleryNovo from "@/components/novo/ProductGalleryNovo";
import ProductInquiryNovo from "@/components/novo/ProductInquiryNovo";
import ProductDescription, { parseDescription } from "@/components/novo/ProductDescription";
import ProductVideoNovo from "@/components/novo/ProductVideoNovo";
import QtyQuickPick from "@/components/novo/QtyQuickPick";
import ShareProductButton from "@/components/novo/ShareProductButton";
import ProductStickyCta from "@/components/novo/ProductStickyCta";
import ConsentTracking from "@/components/novo/ConsentTracking";
import { ContactLink, TrackProductView } from "@/components/novo/ProductContactLinks";
import { telHref, whatsappUrl } from "@/lib/phone";
import { eur, normalizeDiscounts, saleInfo, shortDate } from "@/lib/pricing";
import NfcPagePreview from "@/components/novo/NfcPagePreview";
import NfcPageOption from "@/components/novo/NfcPageOption";

export const revalidate = 0;

const BASE_URL = "https://www.probajnovo.com";

type Params = { slug: string };

function priceLabel(priceEur: number | null) {
  return priceEur != null ? `od ${eur(priceEur)}` : "Cijena na upit";
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

/** "U cijenu je uključeno" popis iz opisa (ili prvi popis u opisu), najviše 5 stavki. */
function includedItems(description: string): string[] {
  const blocks = parseDescription(description);
  const h = blocks.findIndex((b) => b.kind === "h" && /uklju/i.test(b.text));
  const list =
    (h >= 0 ? blocks.slice(h + 1).find((b) => b.kind === "ul") : undefined) ?? blocks.find((b) => b.kind === "ul");
  return list && list.kind === "ul" ? list.items.slice(0, 5) : [];
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="pd-stars" aria-hidden="true">
      {"★".repeat(full)}
      <span className="pd-stars-off">{"★".repeat(5 - full)}</span>
    </span>
  );
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

  const today = todayDateStringZagreb();
  const sale = saleInfo(product, today);
  const unitPrice = sale.price;
  const url = `${BASE_URL}/proizvodi/${product.slug}`;
  const others = all.filter((p) => p.id !== product.id && p.slug).slice(0, 3);
  const embed = product.videoUrl ? videoEmbed(product.videoUrl) : null;
  // Snimka uploadana u admin (ne YouTube/Vimeo) ide na vrh kao glavni sadržaj.
  const fileVideo = product.videoUrl && !embed ? product.videoUrl : null;
  const included = includedItems(product.description);
  const ctaLabel = (product.ctaButtonText?.trim() || "Zatraži ponudu").toUpperCase();
  const reviews = product.testimonials ?? [];
  const faq = product.faq ?? [];
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const waHref = contact.phone
    ? whatsappUrl(contact.phone, `Pozdrav! Zanima me ${product.name} (${url})`)
    : null;
  const phoneHref = contact.phone ? telHref(contact.phone) : null;
  const discounts = normalizeDiscounts(product.quantityDiscounts);
  const addons = (product.addonProductIds ?? [])
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ id: p.id, name: p.name, priceEur: saleInfo(p, today).price }));
  const nfcMonthly = product.showNfcPreview ? product.nfcPageMonthlyEur : null;
  const assurance = [
    { label: "DOSTAVA", text: contact.deliveryText },
    { label: "IZRADA", text: contact.productionText },
    { label: "JAMSTVO", text: contact.guaranteeText },
  ].filter((r): r is { label: string; text: string } => Boolean(r.text));

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
      ...(reviews.length
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: Number(avgRating.toFixed(1)),
              reviewCount: reviews.length,
            },
            review: reviews.map((r) => ({
              "@type": "Review",
              author: { "@type": "Person", name: r.author },
              reviewBody: r.text,
              reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
            })),
          }
        : {}),
      ...(product.priceEur != null
        ? {
            offers: {
              "@type": "Offer",
              url,
              price: unitPrice,
              priceCurrency: "EUR",
              ...(sale.endsAt ? { priceValidUntil: sale.endsAt } : {}),
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
    ...(faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          },
        ]
      : []),
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
          <span className="pd-crumbs-share">
            <ShareProductButton url={url} title={product.name} />
          </span>
        </div>

        <div className="pd-scroll">
          <article className={fileVideo ? "pd-top pd-split pd-top--video" : "pd-top pd-split"}>
            {fileVideo ? (
              <div className="pd-media">
                <ProductVideoNovo src={fileVideo} name={product.name} poster={product.images[0]} />
              </div>
            ) : (
              <div className="pd-media">
                <ProductGalleryNovo images={product.images} name={product.name} />
              </div>
            )}

            <div className="pd-info pd-head">
              <h1 className="pd-title">{product.name}</h1>
              {reviews.length > 0 && (
                <a href="#recenzije" className="pd-rating">
                  <Stars rating={avgRating} />
                  <span>
                    {avgRating.toLocaleString("hr-HR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (
                    {reviews.length})
                  </span>
                </a>
              )}
              <div className="pd-price">
                <span className="pd-price-value">{priceLabel(unitPrice)}</span>
                {sale.active && product.priceEur != null && (
                  <s className="pd-price-was">{eur(product.priceEur)}</s>
                )}
                {sale.active && (
                  <span className="pd-price-sale">
                    −{sale.percent} %{sale.endsAt ? ` do ${shortDate(sale.endsAt)}` : ""}
                  </span>
                )}
              </div>
              {product.tagline && <p className="pd-tagline">{product.tagline}</p>}
            </div>

            <div className="pd-info pd-rest">
              {nfcMonthly != null && (
                <NfcPageOption monthlyEur={nfcMonthly} idPrefix="pd" previewHref="#stranica" />
              )}

              <QtyQuickPick
                priceEur={unitPrice}
                ctaLabel={ctaLabel}
                productName={product.name}
                discounts={discounts}
                whatsappHref={waHref}
              />

              <div className="pd-faq pd-acc" id="detalji">
                {product.description.trim() && (
                  <details className="pd-faq-item">
                    <summary>Opis</summary>
                    <div className="pd-acc-body">
                      <ProductDescription text={product.description} />
                    </div>
                  </details>
                )}
                {(included.length > 0 || product.features.length > 0) && (
                  <details className="pd-faq-item">
                    <summary>Što dobivate</summary>
                    <ul className="pd-acc-list">
                      {(included.length > 0 ? included : product.features).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <details className="pd-faq-item">
                  <summary>Dostava, jamstvo i povrat</summary>
                  <dl className="pd-assure pd-acc-body">
                    {assurance.map((r) => (
                      <div key={r.label} className="pd-assure-row">
                        <dt className="mono">{r.label}</dt>
                        <dd>{r.text}</dd>
                      </div>
                    ))}
                    <div className="pd-assure-row">
                      <dt className="mono">POVRAT</dt>
                      <dd>
                        <Link href="/povrat" className="link">
                          Uvjeti povrata i reklamacije
                        </Link>
                      </dd>
                    </div>
                  </dl>
                </details>
                {fileVideo && product.images.length > 0 && (
                  <details className="pd-faq-item pd-photos">
                    <summary>Fotografije ({product.images.length})</summary>
                    <div className="pd-acc-body">
                      <ProductGalleryNovo images={product.images} name={product.name} />
                    </div>
                  </details>
                )}
              </div>
            </div>
          </article>

          {product.showNfcPreview && <NfcPagePreview monthlyEur={nfcMonthly} />}

          {reviews.length > 0 && (
            <section className="pd-section" id="recenzije" aria-labelledby="pd-recenzije">
              <h2 id="pd-recenzije" className="section-title">
                RECENZIJE KUPACA
              </h2>
              <ul className="pd-reviews">
                {reviews.map((r, i) => (
                  <li key={i} className="pd-review">
                    <Stars rating={r.rating} />
                    <blockquote>{r.text}</blockquote>
                    <span className="pd-review-author mono">{r.author.toUpperCase()}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {faq.length > 0 && (
            <section className="pd-section" id="pitanja" aria-labelledby="pd-faq">
              <h2 id="pd-faq" className="section-title">
                ČESTA PITANJA
              </h2>
              <div className="pd-faq">
                {faq.map((f, i) => (
                  <details key={i} className="pd-faq-item">
                    <summary>{f.question}</summary>
                    <p>{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {embed && (
            <section className="pd-section" aria-labelledby="pd-video">
              <h2 id="pd-video" className="section-title">
                VIDEO
              </h2>
              <div className="pd-video">
                <iframe
                  src={embed}
                  title={`${product.name} — video`}
                  loading="lazy"
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
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
                ILI:{" "}
                <a href={`mailto:${contact.contactEmail}?subject=${encodeURIComponent(`Upit — ${product.name}`)}`}>
                  EMAIL
                </a>
                {phoneHref && contact.phone && (
                  <>
                    {" · "}
                    <ContactLink href={phoneHref} productName={product.name} channel="phone">
                      {contact.phone}
                    </ContactLink>
                  </>
                )}
                {waHref && (
                  <>
                    {" · "}
                    <ContactLink href={waHref} productName={product.name} channel="whatsapp">
                      WHATSAPP
                    </ContactLink>
                  </>
                )}
              </p>
            </div>
            <ProductInquiryNovo
              productId={product.id}
              productName={product.name}
              priceEur={unitPrice}
              ctaLabel={product.ctaButtonText}
              discounts={discounts}
              addons={addons}
              addonDiscountPercent={product.addonDiscountPercent ?? 0}
              nfcMonthlyEur={nfcMonthly}
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
                        <span className="pl-card-price mono">{priceLabel(saleInfo(p, today).price)}</span>
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
          <ProductStickyCta
            price={priceLabel(unitPrice)}
            label={ctaLabel}
            whatsappHref={waHref}
            productName={product.name}
          />
        </div>
      </div>
      <TrackProductView name={product.name} slug={product.slug} priceEur={unitPrice} />
      <ConsentTracking metaPixelId={contact.metaPixelId} gaMeasurementId={contact.gaMeasurementId} />
    </NovoShell>
  );
}

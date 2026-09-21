import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/db/queries";
import InquiryForm from "@/components/InquiryForm";
import ProductGallery from "@/components/ProductGallery";
import { HeroScrollVideoReveal, type TagItem } from "@/components/ui/hero-scroll-video-pin-reveal";
import LegalFooterLinks from "@/components/LegalFooterLinks";

const PRODUCT_HERO_COLORS: Omit<TagItem, "text">[] = [
  { background: "#0000c3", color: "#ffffff" }, // navy
  { background: "#ff7f00", color: "#1a1200" }, // orange
  { background: "#6a21b0", color: "#ffffff" }, // purple
  { background: "#f3f3fb", color: "#0a0a1a" }, // svijetla
];

export const revalidate = 0;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.published) {
    return { title: "Proizvod — NOVO", robots: { index: false, follow: false } };
  }
  const title = product.seoTitle || `${product.name} — NOVO`;
  const description = product.seoDescription || product.tagline;
  const url = `https://www.probajnovo.com/proizvodi/${product.slug}`;
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    icons: { icon: "/favicon-orange.png" },
    openGraph: {
      title,
      description,
      url,
      images: product.images[0] ? [{ url: product.images[0] }] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || !product.published) notFound();

  const heroTags: TagItem[] = product.features
    .slice(0, 4)
    .map((f, i) => ({ text: f, ...PRODUCT_HERO_COLORS[i % PRODUCT_HERO_COLORS.length] }));

  return (
    <div className="novo-product-page">
      <div className="novo-product-topbar">
        <Link href="/" className="novo-product-logo">NOVO</Link>
        <Link href="/?view=products" className="novo-product-back">← SVI PROIZVODI</Link>
      </div>

      <HeroScrollVideoReveal
        headingText={product.tagline || product.name}
        tags={heroTags.length > 0 ? heroTags : undefined}
        subText={product.description || undefined}
        videoSrc={product.videoUrl || undefined}
        posterSrc={product.images[0] || undefined}
        bottomText="Detalji i upit ispod."
      />

      <div className="novo-product-wrap">
        <div className="novo-product-hero">
          <ProductGallery images={product.images} name={product.name} />

          <div className="novo-product-info">
            {(product.featured || product.category) && (
              <div className="novo-product-info-top">
                {product.featured && <span className="novo-product-badge">ISTAKNUTO</span>}
                {product.category && <span className="novo-product-card-category">{product.category}</span>}
              </div>
            )}
            <h1>{product.name}</h1>
            <p className="novo-product-tagline">{product.tagline}</p>
            <p className="novo-product-price">
              {product.priceEur != null ? `od ${product.priceEur} €` : "Cijena na upit"}
            </p>

            {product.features.length > 0 && (
              <div className="novo-product-features">
                {product.features.map((f) => (
                  <span key={f} className="novo-product-feature-chip">
                    {f}
                  </span>
                ))}
              </div>
            )}

            <p className="novo-product-desc">{product.description}</p>
          </div>
        </div>

        <div className="novo-product-inquiry">
          <h2>Zanima me ovaj proizvod</h2>
          <p>Pošalji nam upit s nekoliko detalja — odgovaramo unutar 24h.</p>
          <InquiryForm
            source="product"
            sourceId={product.id}
            sourceName={product.name}
            ctaLabel={product.ctaButtonText || undefined}
          />
        </div>

        <LegalFooterLinks />
      </div>
    </div>
  );
}

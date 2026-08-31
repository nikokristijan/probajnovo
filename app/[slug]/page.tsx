import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropertyBySlug, getCompanyBySlug, getAgency } from "@/lib/db/queries";
import type { Agency, Property, Company } from "@/lib/db/schema";
import RevealSection from "@/components/RevealSection";
import GalleryLightbox from "@/components/GalleryLightbox";
import StayInteractions from "@/components/StayInteractions";
import InquiryForm from "@/components/InquiryForm";

export const revalidate = 0;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const url = `https://www.probajnovo.com/${slug}`;
  const property = await getPropertyBySlug(slug);
  if (property && property.published) {
    const title = `${property.name} — ${property.location}`;
    const image = property.bannerImage || property.images[0];
    return {
      title,
      description: property.tagline,
      robots: { index: true, follow: true },
      icons: { icon: property.faviconUrl || "/favicon-orange.png" },
      // Kanonski URL + Open Graph/Twitter: pomaže Googleu i društvenim mrežama
      // da OVU stranicu (naslov = ime vikendice, ne "NOVO") prepoznaju kao
      // zaseban entitet, umjesto da signal razvodne apex/www/poddomena varijante.
      alternates: { canonical: url },
      openGraph: {
        title,
        description: property.tagline,
        url,
        siteName: "NOVO",
        locale: "hr_HR",
        type: "website",
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: property.tagline,
        ...(image ? { images: [image] } : {}),
      },
    };
  }
  const company = await getCompanyBySlug(slug);
  if (company && company.published) {
    const title = `${company.name} — ${company.location}`;
    const image = company.bannerImage || company.images[0];
    return {
      title,
      description: company.tagline,
      robots: { index: true, follow: true },
      icons: { icon: company.faviconUrl || "/favicon-orange.png" },
      alternates: { canonical: url },
      openGraph: {
        title,
        description: company.tagline,
        url,
        siteName: "NOVO",
        locale: "hr_HR",
        type: "website",
        ...(image ? { images: [{ url: image }] } : {}),
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: company.tagline,
        ...(image ? { images: [image] } : {}),
      },
    };
  }
  return {};
}

/**
 * Serijalizira JSON-LD objekt za <script type="application/ld+json">.
 * Escapa "<" da spriječi da sadržaj (npr. korisnički opis) prerano zatvori
 * <script> tag — standardna zaštita za dangerouslySetInnerHTML s JSON-om.
 */
function jsonLdProps(data: Record<string, unknown>): { __html: string } {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}

/** Prepoznaje YouTube/Vimeo poveznice i vraća embed URL; inače null (pa se prikaže kao obična poveznica). */
function videoEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

/** Sitna ikona uz sadržaj (amenity) — prepoznaje uobičajene hrvatske riječi, inače prikazuje generičku kvačicu. */
function AmenityIcon({ label }: { label: string }) {
  const l = label.toLowerCase();
  const common = { width: 18, height: 18, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (/wifi|internet/.test(l))
    return (
      <svg {...common}><path d="M2 7.5c4.5-4 11.5-4 16 0M5 11c3-2.6 7-2.6 10 0M8 14.3c1.3-1 2.7-1 4 0" /><circle cx="10" cy="17" r="1" fill="currentColor" stroke="none" /></svg>
    );
  if (/parking|garaž/.test(l))
    return (
      <svg {...common}><rect x="3" y="2.5" width="14" height="15" rx="2" /><path d="M8 14V6h3a2.5 2.5 0 0 1 0 5H8" /></svg>
    );
  if (/bazen|pool/.test(l))
    return (
      <svg {...common}><path d="M2 8h16M2 12h16" /><path d="M2 15.5c1.4 1 2.8 1 4.2 0s2.8-1 4.2 0 2.8 1 4.2 0 2.8-1 4.2 0" /><path d="M6 8V4.5l3 2 3-2v3.5" /></svg>
    );
  if (/kamin|fireplace|ogrjev/.test(l))
    return (
      <svg {...common}><path d="M10 2c1.5 2 2.5 3.6 1.2 5.3C13 8 14 9.7 14 11.3a4 4 0 1 1-8 0C6 8.6 8.4 7.8 8.6 5.6 8.7 4.4 9.2 3.2 10 2Z" /></svg>
    );
  if (/klima|hlađenje|ac\b/.test(l))
    return (
      <svg {...common}><path d="M10 2v16M2 10h16M4.5 4.5l11 11M15.5 4.5l-11 11" /></svg>
    );
  if (/\btv\b|televiz/.test(l))
    return (
      <svg {...common}><rect x="2.5" y="4" width="15" height="10" rx="1.5" /><path d="M7 17.5h6M10 14v3.5" /></svg>
    );
  if (/kuhinj|kitchen/.test(l))
    return (
      <svg {...common}><path d="M5 2v6a2 2 0 0 0 4 0V2M7 8v10M14 2v7c-1.4 0-2.5 1.1-2.5 2.5V12H15V2" /></svg>
    );
  if (/roštilj|grill|bbq/.test(l))
    return (
      <svg {...common}><ellipse cx="10" cy="8" rx="7" ry="2.5" /><path d="M4.5 8.5 6 17M15.5 8.5 14 17M10 8.5V17" /></svg>
    );
  if (/vrt|garden|okoliš|dvorište/.test(l))
    return (
      <svg {...common}><path d="M10 18V9M10 9C6 9 4 6.5 4 3c3.5 0 6 2 6 6Zm0 0c4 0 6-2.5 6-6-3.5 0-6 2-6 6Z" /></svg>
    );
  if (/ljubimc|pas\b|mačk|pets/.test(l))
    return (
      <svg {...common}><circle cx="6" cy="6.5" r="1.4" /><circle cx="14" cy="6.5" r="1.4" /><circle cx="3.6" cy="10" r="1.2" /><circle cx="16.4" cy="10" r="1.2" /><path d="M10 10.5c-2.5 0-4.2 1.7-4.2 3.6 0 2 1.8 2.9 4.2 2.9s4.2-.9 4.2-2.9c0-1.9-1.7-3.6-4.2-3.6Z" /></svg>
    );
  if (/perilic|washer|sušilic/.test(l))
    return (
      <svg {...common}><rect x="3" y="2.5" width="14" height="15" rx="2" /><circle cx="10" cy="11" r="4" /><circle cx="6" cy="5" r="0.6" fill="currentColor" stroke="none" /></svg>
    );
  if (/plaž|beach|jezero|more\b/.test(l))
    return (
      <svg {...common}><path d="M2 18c3-8 13-8 16 0" /><path d="M10 18V9m0 0c2.5-1 4-3.3 3.4-6C10.5 3.5 8.5 6 9 9" /></svg>
    );
  if (/sauna|jacuzzi|whirlpool|spa\b/.test(l))
    return (
      <svg {...common}><path d="M4 11c1-1.5.5-2.7-.5-4C4.8 8 6 8.6 6 10s-1 1.6-1 3a2 2 0 1 0 4 0" /><rect x="7" y="10" width="11" height="7" rx="1.5" /><path d="M9.5 13.5h6" /></svg>
    );
  return (
    <svg {...common}><circle cx="10" cy="10" r="7.5" /><path d="M7 10.2 9 12.3 13.3 7.7" /></svg>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="stay-stars" aria-label={`${rating} od 5 zvjezdica`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? "on" : ""}>★</span>
      ))}
    </div>
  );
}

export default async function SlugPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const [property, agency] = await Promise.all([getPropertyBySlug(slug), getAgency()]);

  if (property && property.published) {
    return <PropertyView property={property} agency={agency} />;
  }

  const company = await getCompanyBySlug(slug);
  if (company && company.published) {
    return <CompanyView company={company} agency={agency} />;
  }

  notFound();
}

export function PropertyView({
  property,
  agency,
  lang = "hr",
}: {
  property: Property;
  agency: Agency | null;
  lang?: "hr" | "en";
}) {
  // Sitni pomoćnik za par desetaka fiksnih UI natpisa (naslovi sekcija, gumbi…)
  // — vidi lib/translate.ts za veći, DeepL-prevedeni gostov sadržaj (opis,
  // sadržaji, kućni red, FAQ, bilješka domaćina), koji se prevodi PRIJE nego
  // stigne ovamo (property.tagline itd. je već engleski kad je lang="en").
  const L = (hr: string, en: string) => (lang === "en" ? en : hr);
  const layout =
    property.layoutStyle === "editorial" ||
    property.layoutStyle === "raw" ||
    property.layoutStyle === "apple"
      ? property.layoutStyle
      : "classic";
  const stayClass = `stay stay-${layout}${property.darkMode ? " stay-dark" : ""}`;
  const accentStyle = { "--accent": property.accentColor } as React.CSSProperties;
  const contactEmail = property.contactEmail || agency?.contactEmail || "hello@novo.studio";
  // Ako admin nije eksplicitno postavio banner, koristi prvu sliku iz galerije —
  // bolje da vrh stranice pokaže stvarnu fotografiju nego prazan tekstualni blok.
  const effectiveBanner = property.bannerImage || property.images[0] || null;
  const gallery = property.images.filter((src) => src !== effectiveBanner);
  const mailHref = `mailto:${contactEmail}?subject=Upit — ${property.name}`;
  const telHref = property.phone ? `tel:${property.phone.replace(/[^\d+]/g, "")}` : null;
  const waHref = property.phone
    ? `https://wa.me/${whatsAppNumber(property.phone)}?text=${encodeURIComponent(`Pozdrav! Imam upit vezan za ${property.name}.`)}`
    : null;
  const embedSrc = property.videoUrl ? videoEmbedSrc(property.videoUrl) : null;

  const marqueeItems = [
    property.location,
    `${L("od", "from")} ${property.priceFromEur} €${L("/noć", "/night")}`,
    `${property.capacityGuests} ${L("gostiju", "guests")}`,
    property.tagline,
    ...property.amenities.slice(0, 4),
  ].filter(Boolean);

  // Numerirane sekcije (01, 02…) — editorial detalj, brojimo samo sekcije
  // koje se stvarno prikazuju za ovu vikendicu (evaluira se redom kroz JSX).
  let sectionNo = 0;
  const eyebrowNo = () => String(++sectionNo).padStart(2, "0");
  // "O objektu" je uvijek prva numerirana sekcija — izvučeno unaprijed jer
  // editorial layout treba isti broj i za div-atribut (pozadinski "duh" broj) i za eyebrow.
  const aboutNo = eyebrowNo();

  const propertyImages = [effectiveBanner, ...gallery].filter((s): s is string => Boolean(s));
  const propertyJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: property.name,
    description: property.description || property.tagline,
    url: `https://www.probajnovo.com/${property.slug}`,
    ...(propertyImages.length > 0 ? { image: propertyImages } : {}),
    address: {
      "@type": "PostalAddress",
      addressLocality: property.location,
      addressCountry: "HR",
    },
    priceRange: `${property.priceFromEur} EUR`,
    ...(property.phone ? { telephone: property.phone } : {}),
  };
  if (property.testimonials.length > 0) {
    propertyJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: (
        property.testimonials.reduce((sum, t) => sum + t.rating, 0) / property.testimonials.length
      ).toFixed(1),
      reviewCount: property.testimonials.length,
    };
  }

  return (
    <div className={stayClass} style={accentStyle}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdProps(propertyJsonLd)} />
      <StayInteractions />

      <header className="stay-nav">
        <span className="stay-nav-brand">NOVO</span>
        <div className="stay-nav-right">
          <a
            className="stay-lang-switch"
            href={lang === "en" ? `/${property.slug}` : `/en/${property.slug}`}
          >
            {lang === "en" ? "HR" : "EN"}
          </a>
          <a className="stay-nav-cta" href={mailHref} data-magnetic>
            {L("Pošaljite upit", "Send an inquiry")}
          </a>
        </div>
      </header>

      {layout === "raw" && marqueeItems.length > 0 && (
        <div className="stay-marquee" aria-hidden="true">
          <div className="stay-marquee-track">
            {[...marqueeItems, ...marqueeItems].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {effectiveBanner ? (
        <div className="stay-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={effectiveBanner} alt={property.name} data-parallax />
          {layout === "editorial" && (
            <div className="stay-spine" aria-hidden="true">
              {property.name}
            </div>
          )}
          <div className="stay-banner-overlay">
            {layout === "classic" && property.reviewBadges.length > 0 && (
              <div className="stay-stamp">{property.reviewBadges[0]}</div>
            )}
            <div className="loc">{property.location}</div>
            <h1>{property.name}</h1>
            <p>{property.tagline}</p>
          </div>
        </div>
      ) : (
        <div className="stay-hero">
          {layout === "editorial" && (
            <div className="stay-spine" aria-hidden="true">
              {property.name}
            </div>
          )}
          {layout === "classic" && property.reviewBadges.length > 0 && (
            <div className="stay-stamp">{property.reviewBadges[0]}</div>
          )}
          <div className="loc">{property.location}</div>
          <h1>{property.name}</h1>
          <p>{property.tagline}</p>
        </div>
      )}

      {layout === "classic" && gallery.length > 0 && (
        <div className="stay-classic-polaroids" aria-hidden="true">
          {gallery.slice(0, 3).map((src, i) => (
            <div className="stay-polaroid" key={src + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" decoding="async" />
              {property.imageCategories[src] && (
                <div className="stay-polaroid-cap">{property.imageCategories[src]}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="stay-stats">
        <div className="stay-stat">{property.capacityGuests} {L("gostiju", "guests")}</div>
        <div className="stay-stat">{property.bedrooms} {L("spavaće sobe", "bedrooms")}</div>
        <div className="stay-stat">{property.distanceFromCenter}</div>
        <div className="stay-stat">{L("od", "from")} {property.priceFromEur} €{L("/noć", "/night")}</div>
      </div>

      {property.reviewBadges.length > 0 && (
        <div className="stay-badges">
          {property.reviewBadges.map((b) => (
            <span className="stay-badge" key={b}>
              {b}
            </span>
          ))}
        </div>
      )}

      <RevealSection className="stay-section stay-about" data-secno={aboutNo}>
        <h2 className="stay-eyebrow">
          <span className="stay-eyebrow-no">{aboutNo}</span>{L("O objektu", "About")}
        </h2>
        <p className={layout === "editorial" ? "stay-dropcap" : undefined}>
          {property.description}
        </p>
      </RevealSection>

      {layout === "editorial" && (
        <div className="stay-pullquote">
          <RevealSection>
            <blockquote>“{property.tagline}”</blockquote>
          </RevealSection>
        </div>
      )}

      {gallery.length > 0 && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Galerija", "Gallery")}
          </h2>
          <GalleryLightbox images={gallery} alt={property.name} categories={property.imageCategories} />
        </RevealSection>
      )}

      {property.videoUrl && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Video", "Video")}
          </h2>
          {embedSrc ? (
            <div className="stay-video-frame">
              <iframe
                src={embedSrc}
                title={`Video — ${property.name}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a className="stay-map-link" href={property.videoUrl} target="_blank" rel="noreferrer" data-magnetic>
              {L("Pogledajte video ↗", "Watch video ↗")}
            </a>
          )}
        </RevealSection>
      )}

      {property.amenities.length > 0 && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Sadržaji", "Amenities")}
          </h2>
          <div className="stay-amenities">
            {property.amenities.map((a) => (
              <div className="stay-amenity" key={a}>
                <AmenityIcon label={a} />
                <span>{a}</span>
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      {(property.checkInTime || property.checkOutTime) && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Prijava & odjava", "Check-in & check-out")}
          </h2>
          <div className="stay-hours">
            {property.checkInTime && (
              <div className="stay-hour">
                <span className="stay-hour-label mono">{L("PRIJAVA", "CHECK-IN")}</span>
                <span className="stay-hour-value">{property.checkInTime}</span>
              </div>
            )}
            {property.checkOutTime && (
              <div className="stay-hour">
                <span className="stay-hour-label mono">{L("ODJAVA", "CHECK-OUT")}</span>
                <span className="stay-hour-value">{property.checkOutTime}</span>
              </div>
            )}
          </div>
        </RevealSection>
      )}

      {property.houseRules.length > 0 && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Kućni red", "House rules")}
          </h2>
          <ul className="stay-rules">
            {property.houseRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </RevealSection>
      )}

      {property.testimonials.length > 0 && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Što kažu gosti", "What guests say")}
          </h2>
          <div className="stay-testimonials">
            {property.testimonials.map((t, i) => (
              <div className="stay-testimonial" key={t.author + i}>
                <StarRow rating={t.rating} />
                <p>“{t.text}”</p>
                <div className="stay-testimonial-author">{t.author}</div>
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      {property.faq.length > 0 && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Često postavljana pitanja", "Frequently asked questions")}
          </h2>
          <div className="stay-faq">
            {property.faq.map((f, i) => (
              <details className="stay-faq-item" key={f.question + i}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </RevealSection>
      )}

      {(property.hostName || property.hostNote) && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Domaćin", "Host")}
          </h2>
          <div className="stay-host">
            {property.hostPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={property.hostPhoto}
                alt={property.hostName ?? L("Domaćin", "Host")}
                className="stay-host-photo"
                loading="lazy"
                decoding="async"
              />
            )}
            <div>
              {property.hostName && <div className="stay-host-name">{property.hostName}</div>}
              {property.hostNote && <p className="stay-host-note">{property.hostNote}</p>}
            </div>
          </div>
        </RevealSection>
      )}

      {property.mapUrl && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Lokacija", "Location")}
          </h2>
          <a className="stay-map-link" href={property.mapUrl} target="_blank" rel="noreferrer" data-magnetic>
            {L("Otvori na karti ↗", "Open in maps ↗")}
          </a>
        </RevealSection>
      )}

      {property.seasonalPricing.length > 0 && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Sezonski cjenik", "Seasonal pricing")}
          </h2>
          <div className="stay-season-table">
            {property.seasonalPricing.map((s, i) => (
              <div className="stay-season-row" key={s.label + i}>
                <span>{s.label}</span>
                <span className="stay-season-price">{s.priceEur} € {L("/ noć", "/ night")}</span>
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      <RevealSection className="stay-section">
        <div className="stay-book">
          <div>
            <div className="price">
              {property.priceFromEur} € <small>{L("/ noćenje", "/ night")}</small>
            </div>
            <p>{L("Odgovaramo unutar 24h", "We reply within 24h")}</p>
          </div>
          <div className="stay-book-actions">
            {property.availabilityUrl && (
              <a
                className="stay-avail-link"
                href={property.availabilityUrl}
                target="_blank"
                rel="noreferrer"
                data-magnetic
              >
                {L("Provjeri dostupnost ↗", "Check availability ↗")}
              </a>
            )}
            {telHref && (
              <a className="stay-avail-link" href={telHref} data-magnetic>
                {L("Nazovite", "Call")}
              </a>
            )}
            {waHref && (
              <a className="stay-avail-link" href={waHref} target="_blank" rel="noreferrer" data-magnetic>
                WhatsApp
              </a>
            )}
            <a className="bookbtn" href={mailHref} data-magnetic>
              {L("Pošaljite upit", "Send an inquiry")}
            </a>
          </div>
        </div>
      </RevealSection>

      <RevealSection className="stay-section stay-alt">
        <h2 className="stay-eyebrow">
          <span className="stay-eyebrow-no">{eyebrowNo()}</span>{L("Pošaljite upit", "Send an inquiry")}
        </h2>
        <InquiryForm source="property" sourceId={property.id} sourceName={property.name} lang={lang} />
      </RevealSection>

      <footer className="stay-foot">
        {property.name} · {property.location}
        <div className="credit">
          {L("Stranicu pokreće", "Site by")} <Link href="/">NOVO</Link>
        </div>
      </footer>

      <div className="stay-mobile-cta">
        <a href={mailHref}>{L("Pošaljite upit", "Send an inquiry")}</a>
      </div>
    </div>
  );
}

/** Radno vrijeme je slobodan tekst, jedan redak po danu (npr. "Pon–Pet: 8–16").
    Ako redak sadrži ":", dio prije postaje sitna oznaka (kao PRIJAVA/ODJAVA
    kod vikendice), dio poslije glavna vrijednost — inače cijeli redak ide
    kao vrijednost bez oznake. */
/**
 * Normalizira hrvatski broj telefona u međunarodni format bez "+" (kakav
 * wa.me linkovi traže). "091 234 5678" → "385912345678"; ako broj već ima
 * pozivni broj (npr. počinje s "385" ili "00"), samo miče razmake/crtice.
 * Nije 100% robusno za sve zemlje, ali pokriva realan slučaj (HR firme).
 */
function whatsAppNumber(phone: string): string {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "385" + digits.slice(1);
  return digits;
}

function parseWorkingHoursLines(raw: string): { label: string | null; value: string }[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx > 0 && idx < line.length - 1) {
        return { label: line.slice(0, idx).trim().toUpperCase(), value: line.slice(idx + 1).trim() };
      }
      return { label: null, value: line };
    });
}

function CompanyView({ company, agency }: { company: Company; agency: Agency | null }) {
  const layout =
    company.layoutStyle === "editorial" ||
    company.layoutStyle === "raw" ||
    company.layoutStyle === "apple"
      ? company.layoutStyle
      : "classic";
  const stayClass = `stay stay-${layout}${company.darkMode ? " stay-dark" : ""}`;
  const accentStyle = { "--accent": company.accentColor } as React.CSSProperties;
  const contactEmail = company.contactEmail || agency?.contactEmail || "hello@novo.studio";
  const effectiveBanner = company.bannerImage || company.images[0] || null;
  const gallery = company.images.filter((src) => src !== effectiveBanner);
  const mailHref = `mailto:${contactEmail}?subject=Upit — ${company.name}`;
  const telHref = company.phone ? `tel:${company.phone.replace(/[^\d+]/g, "")}` : null;
  const waHref = company.phone
    ? `https://wa.me/${whatsAppNumber(company.phone)}?text=${encodeURIComponent(`Pozdrav! Imam upit vezan za ${company.name}.`)}`
    : null;
  const embedSrc = company.videoUrl ? videoEmbedSrc(company.videoUrl) : null;
  const hoursLines = company.workingHours ? parseWorkingHoursLines(company.workingHours) : [];

  const statItems = [
    company.phone,
    hoursLines[0] ? (hoursLines[0].label ? `${hoursLines[0].label}: ${hoursLines[0].value}` : hoursLines[0].value) : null,
    company.address,
  ].filter((v): v is string => Boolean(v));

  const marqueeItems = [
    company.location,
    company.tagline,
    ...company.services.slice(0, 4).map((s) => s.name),
  ].filter(Boolean);

  let sectionNo = 0;
  const eyebrowNo = () => String(++sectionNo).padStart(2, "0");
  const aboutNo = eyebrowNo();

  const companyImages = [effectiveBanner, ...gallery].filter((s): s is string => Boolean(s));
  const companyJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: company.name,
    description: company.description || company.tagline,
    url: `https://www.probajnovo.com/${company.slug}`,
    ...(companyImages.length > 0 ? { image: companyImages } : {}),
    address: {
      "@type": "PostalAddress",
      ...(company.address ? { streetAddress: company.address } : {}),
      addressLocality: company.location,
      addressCountry: "HR",
    },
    ...(company.phone ? { telephone: company.phone } : {}),
  };
  if (company.testimonials.length > 0) {
    companyJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: (
        company.testimonials.reduce((sum, t) => sum + t.rating, 0) / company.testimonials.length
      ).toFixed(1),
      reviewCount: company.testimonials.length,
    };
  }

  return (
    <div className={stayClass} style={accentStyle}>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdProps(companyJsonLd)} />
      <StayInteractions />

      <header className="stay-nav">
        <span className="stay-nav-brand">NOVO</span>
        <a className="stay-nav-cta" href={mailHref} data-magnetic>
          Pošaljite upit
        </a>
      </header>

      {layout === "raw" && marqueeItems.length > 0 && (
        <div className="stay-marquee" aria-hidden="true">
          <div className="stay-marquee-track">
            {[...marqueeItems, ...marqueeItems].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {effectiveBanner ? (
        <div className="stay-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={effectiveBanner} alt={company.name} data-parallax />
          {layout === "editorial" && (
            <div className="stay-spine" aria-hidden="true">
              {company.name}
            </div>
          )}
          <div className="stay-banner-overlay">
            {layout === "classic" && company.reviewBadges.length > 0 && (
              <div className="stay-stamp">{company.reviewBadges[0]}</div>
            )}
            <div className="loc">{company.location}</div>
            <h1>{company.name}</h1>
            <p>{company.tagline}</p>
          </div>
        </div>
      ) : (
        <div className="stay-hero">
          {layout === "editorial" && (
            <div className="stay-spine" aria-hidden="true">
              {company.name}
            </div>
          )}
          {layout === "classic" && company.reviewBadges.length > 0 && (
            <div className="stay-stamp">{company.reviewBadges[0]}</div>
          )}
          <div className="loc">{company.location}</div>
          <h1>{company.name}</h1>
          <p>{company.tagline}</p>
        </div>
      )}

      {layout === "classic" && gallery.length > 0 && (
        <div className="stay-classic-polaroids" aria-hidden="true">
          {gallery.slice(0, 3).map((src, i) => (
            <div className="stay-polaroid" key={src + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" decoding="async" />
              {company.imageCategories[src] && (
                <div className="stay-polaroid-cap">{company.imageCategories[src]}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {statItems.length > 0 && (
        <div className="stay-stats">
          {statItems.map((s, i) => (
            <div className="stay-stat" key={s + i}>
              {s}
            </div>
          ))}
        </div>
      )}

      {company.reviewBadges.length > 0 && (
        <div className="stay-badges">
          {company.reviewBadges.map((b) => (
            <span className="stay-badge" key={b}>
              {b}
            </span>
          ))}
        </div>
      )}

      <RevealSection className="stay-section stay-about" data-secno={aboutNo}>
        <h2 className="stay-eyebrow">
          <span className="stay-eyebrow-no">{aboutNo}</span>O nama
        </h2>
        <p className={layout === "editorial" ? "stay-dropcap" : undefined}>{company.description}</p>
      </RevealSection>

      {layout === "editorial" && (
        <div className="stay-pullquote">
          <RevealSection>
            <blockquote>“{company.tagline}”</blockquote>
          </RevealSection>
        </div>
      )}

      {gallery.length > 0 && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Galerija
          </h2>
          <GalleryLightbox images={gallery} alt={company.name} categories={company.imageCategories} />
        </RevealSection>
      )}

      {company.videoUrl && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Video
          </h2>
          {embedSrc ? (
            <div className="stay-video-frame">
              <iframe
                src={embedSrc}
                title={`Video — ${company.name}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a className="stay-map-link" href={company.videoUrl} target="_blank" rel="noreferrer" data-magnetic>
              Pogledajte video ↗
            </a>
          )}
        </RevealSection>
      )}

      {company.services.length > 0 && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Usluge &amp; proizvodi
          </h2>
          <div className="stay-season-table">
            {company.services.map((s, i) => (
              <div className="stay-season-row" key={s.name + i}>
                <span>
                  {s.name}
                  {s.description && (
                    <>
                      <br />
                      <span style={{ fontWeight: 400, fontSize: "0.85em", opacity: 0.75 }}>
                        {s.description}
                      </span>
                    </>
                  )}
                </span>
                <span className="stay-season-price">
                  {s.priceEur != null ? `${s.priceEur} €` : "na upit"}
                </span>
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      {hoursLines.length > 0 && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Radno vrijeme
          </h2>
          <div className="stay-hours">
            {hoursLines.map((h, i) => (
              <div className="stay-hour" key={i}>
                {h.label && <span className="stay-hour-label mono">{h.label}</span>}
                <span className="stay-hour-value">{h.value}</span>
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      {company.testimonials.length > 0 && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Što kažu klijenti
          </h2>
          <div className="stay-testimonials">
            {company.testimonials.map((t, i) => (
              <div className="stay-testimonial" key={t.author + i}>
                <StarRow rating={t.rating} />
                <p>“{t.text}”</p>
                <div className="stay-testimonial-author">{t.author}</div>
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      {company.faq.length > 0 && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Često postavljana pitanja
          </h2>
          <div className="stay-faq">
            {company.faq.map((f, i) => (
              <details className="stay-faq-item" key={f.question + i}>
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </RevealSection>
      )}

      {(company.address || company.phone || company.mapUrl || company.instagramUrl || company.facebookUrl) && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Kontakt &amp; lokacija
          </h2>
          {(company.address || company.phone) && (
            <p style={{ fontSize: 15.5, lineHeight: 1.8, color: "#4a4030", margin: 0 }}>
              {company.address}
              {company.address && company.phone && <br />}
              {company.phone}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: company.address || company.phone ? 4 : 0 }}>
            {company.mapUrl && (
              <a className="stay-map-link" href={company.mapUrl} target="_blank" rel="noreferrer" data-magnetic>
                Otvori na karti ↗
              </a>
            )}
            {company.instagramUrl && (
              <a className="stay-map-link" href={company.instagramUrl} target="_blank" rel="noreferrer" data-magnetic>
                Instagram ↗
              </a>
            )}
            {company.facebookUrl && (
              <a className="stay-map-link" href={company.facebookUrl} target="_blank" rel="noreferrer" data-magnetic>
                Facebook ↗
              </a>
            )}
          </div>
        </RevealSection>
      )}

      <RevealSection className="stay-section">
        <div className="stay-book">
          <div>
            <div className="price" style={{ fontSize: 22 }}>
              {company.name}
            </div>
            <p>Odgovaramo unutar 24h</p>
          </div>
          <div className="stay-book-actions">
            {telHref && (
              <a className="stay-avail-link" href={telHref} data-magnetic>
                Nazovite
              </a>
            )}
            {waHref && (
              <a className="stay-avail-link" href={waHref} target="_blank" rel="noreferrer" data-magnetic>
                WhatsApp
              </a>
            )}
            <a className="bookbtn" href={mailHref} data-magnetic>
              Pošaljite upit
            </a>
          </div>
        </div>
      </RevealSection>

      <RevealSection className="stay-section stay-alt">
        <h2 className="stay-eyebrow">
          <span className="stay-eyebrow-no">{eyebrowNo()}</span>Pošaljite upit
        </h2>
        <InquiryForm source="company" sourceId={company.id} sourceName={company.name} />
      </RevealSection>

      <footer className="stay-foot">
        {company.name} · {company.location}
        <div className="credit">
          Stranicu pokreće <Link href="/">NOVO</Link>
        </div>
      </footer>

      <div className="stay-mobile-cta">
        <a href={mailHref}>Pošaljite upit</a>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropertyBySlug, getAgency } from "@/lib/db/queries";
import RevealSection from "@/components/RevealSection";
import GalleryLightbox from "@/components/GalleryLightbox";
import StayInteractions from "@/components/StayInteractions";

export const revalidate = 0;

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);
  if (!property || !property.published) return {};
  return {
    title: `${property.name} — ${property.location}`,
    description: property.tagline,
    robots: { index: true, follow: true },
  };
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const [property, agency] = await Promise.all([getPropertyBySlug(slug), getAgency()]);

  if (!property || !property.published) {
    notFound();
  }

  const layout = property.layoutStyle === "editorial" || property.layoutStyle === "raw"
    ? property.layoutStyle
    : "classic";
  const stayClass = `stay stay-${layout}${property.darkMode ? " stay-dark" : ""}`;
  const accentStyle = { "--accent": property.accentColor } as React.CSSProperties;
  const contactEmail = property.contactEmail || agency?.contactEmail || "hello@novo.studio";
  const gallery = property.images.filter((src) => src !== property.bannerImage);
  const mailHref = `mailto:${contactEmail}?subject=Upit — ${property.name}`;

  const marqueeItems = [
    property.location,
    `od ${property.priceFromEur} €/noć`,
    `${property.capacityGuests} gostiju`,
    property.tagline,
    ...property.amenities.slice(0, 4),
  ].filter(Boolean);

  // Numerirane sekcije (01, 02…) — editorial detalj, brojimo samo sekcije
  // koje se stvarno prikazuju za ovu vikendicu (evaluira se redom kroz JSX).
  let sectionNo = 0;
  const eyebrowNo = () => String(++sectionNo).padStart(2, "0");

  return (
    <div className={stayClass} style={accentStyle}>
      <StayInteractions />

      <header className="stay-nav">
        <Link href="/" className="stay-nav-brand">
          NOVO
        </Link>
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

      {property.bannerImage ? (
        <div className="stay-banner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={property.bannerImage} alt={property.name} />
          <div className="stay-banner-overlay">
            <div className="loc">{property.location}</div>
            <h1>{property.name}</h1>
            <p>{property.tagline}</p>
          </div>
        </div>
      ) : (
        <div className="stay-hero">
          <div className="loc">{property.location}</div>
          <h1>{property.name}</h1>
          <p>{property.tagline}</p>
        </div>
      )}

      <div className="stay-stats">
        <div className="stay-stat">{property.capacityGuests} gostiju</div>
        <div className="stay-stat">{property.bedrooms} spavaće sobe</div>
        <div className="stay-stat">{property.distanceFromCenter}</div>
        <div className="stay-stat">od {property.priceFromEur} €/noć</div>
      </div>

      <RevealSection className="stay-section stay-about">
        <h2 className="stay-eyebrow">
          <span className="stay-eyebrow-no">{eyebrowNo()}</span>O objektu
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
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Galerija
          </h2>
          <GalleryLightbox images={gallery} alt={property.name} />
        </RevealSection>
      )}

      {property.amenities.length > 0 && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Sadržaji
          </h2>
          <div className="stay-amenities">
            {property.amenities.map((a) => (
              <div className="stay-amenity" key={a}>
                {a}
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      {(property.checkInTime || property.checkOutTime) && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Prijava &amp; odjava
          </h2>
          <div className="stay-hours">
            {property.checkInTime && (
              <div className="stay-hour">
                <span className="stay-hour-label mono">PRIJAVA</span>
                <span className="stay-hour-value">{property.checkInTime}</span>
              </div>
            )}
            {property.checkOutTime && (
              <div className="stay-hour">
                <span className="stay-hour-label mono">ODJAVA</span>
                <span className="stay-hour-value">{property.checkOutTime}</span>
              </div>
            )}
          </div>
        </RevealSection>
      )}

      {property.houseRules.length > 0 && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Kućni red
          </h2>
          <ul className="stay-rules">
            {property.houseRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </RevealSection>
      )}

      {(property.hostName || property.hostNote) && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Domaćin
          </h2>
          <div className="stay-host">
            {property.hostName && <div className="stay-host-name">{property.hostName}</div>}
            {property.hostNote && <p className="stay-host-note">{property.hostNote}</p>}
          </div>
        </RevealSection>
      )}

      {property.mapUrl && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Lokacija
          </h2>
          <a className="stay-map-link" href={property.mapUrl} target="_blank" rel="noreferrer" data-magnetic>
            Otvori na karti ↗
          </a>
        </RevealSection>
      )}

      <RevealSection className="stay-section">
        <div className="stay-book">
          <div>
            <div className="price">
              {property.priceFromEur} € <small>/ noćenje</small>
            </div>
            <p>Odgovaramo unutar 24h</p>
          </div>
          <a className="bookbtn" href={mailHref} data-magnetic>
            Pošaljite upit
          </a>
        </div>
      </RevealSection>

      <footer className="stay-foot">
        {property.name} · {property.location}
        <div className="credit">
          Stranicu pokreće <Link href="/">novo.hr</Link>
        </div>
      </footer>

      <div className="stay-mobile-cta">
        <a href={mailHref}>Pošaljite upit</a>
      </div>
    </div>
  );
}

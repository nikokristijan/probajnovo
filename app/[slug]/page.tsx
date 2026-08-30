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
  // Ako admin nije eksplicitno postavio banner, koristi prvu sliku iz galerije —
  // bolje da vrh stranice pokaže stvarnu fotografiju nego prazan tekstualni blok.
  const effectiveBanner = property.bannerImage || property.images[0] || null;
  const gallery = property.images.filter((src) => src !== effectiveBanner);
  const mailHref = `mailto:${contactEmail}?subject=Upit — ${property.name}`;
  const embedSrc = property.videoUrl ? videoEmbedSrc(property.videoUrl) : null;

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
          <img src={effectiveBanner} alt={property.name} data-parallax />
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

      {property.reviewBadges.length > 0 && (
        <div className="stay-badges">
          {property.reviewBadges.map((b) => (
            <span className="stay-badge" key={b}>
              {b}
            </span>
          ))}
        </div>
      )}

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
          <GalleryLightbox images={gallery} alt={property.name} categories={property.imageCategories} />
        </RevealSection>
      )}

      {property.videoUrl && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Video
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
              Pogledajte video ↗
            </a>
          )}
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

      {property.testimonials.length > 0 && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Što kažu gosti
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
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Često postavljana pitanja
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
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Domaćin
          </h2>
          <div className="stay-host">
            {property.hostPhoto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={property.hostPhoto} alt={property.hostName ?? "Domaćin"} className="stay-host-photo" />
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
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Lokacija
          </h2>
          <a className="stay-map-link" href={property.mapUrl} target="_blank" rel="noreferrer" data-magnetic>
            Otvori na karti ↗
          </a>
        </RevealSection>
      )}

      {property.seasonalPricing.length > 0 && (
        <RevealSection className="stay-section">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>Sezonski cjenik
          </h2>
          <div className="stay-season-table">
            {property.seasonalPricing.map((s, i) => (
              <div className="stay-season-row" key={s.label + i}>
                <span>{s.label}</span>
                <span className="stay-season-price">{s.priceEur} € / noć</span>
              </div>
            ))}
          </div>
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
          <div className="stay-book-actions">
            {property.availabilityUrl && (
              <a
                className="stay-avail-link"
                href={property.availabilityUrl}
                target="_blank"
                rel="noreferrer"
                data-magnetic
              >
                Provjeri dostupnost ↗
              </a>
            )}
            <a className="bookbtn" href={mailHref} data-magnetic>
              Pošaljite upit
            </a>
          </div>
        </div>
      </RevealSection>

      <footer className="stay-foot">
        {property.name} · {property.location}
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

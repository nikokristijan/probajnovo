import "./stay.css";
import Image from "next/image";
import Link from "next/link";
import type { Agency, Property } from "@/lib/db/schema";
import { listBlockedDates } from "@/lib/db/queries";
import { listUnitBlockedDates, mergeUnitBlocked, type PropertyUnit } from "@/lib/db/units";
import RevealSection from "@/components/RevealSection";
import GalleryLightbox from "@/components/GalleryLightbox";
import StayInteractions from "@/components/StayInteractions";
import InquiryForm from "@/components/InquiryForm";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import { AmenityIcon, NavBrand, whatsAppNumber } from "./page";
import { pickLang, stayLinks, unitFacts, unitImages, unitPriceRows } from "./stay-shared";

/**
 * Podstranica jednog apartmana (/[slug]/[unit], /en/[slug]/[unit]) — vlastite
 * fotografije, karakteristike, cjenik i kalendar dostupnosti tog apartmana.
 * Koristi isti .stay-grand vizualni sustav kao glavna stranica (stay.css).
 */
export async function UnitView({
  property,
  agency,
  unit,
  units,
  lang = "hr",
}: {
  property: Property;
  agency: Agency | null;
  unit: PropertyUnit;
  units: PropertyUnit[];
  lang?: "hr" | "en";
}) {
  const L = (hr: string, en: string) => (lang === "en" ? en : hr);
  const links = await stayLinks(property.slug, lang);

  let propertyBlocked: { date: string; source: string }[] = [];
  let unitBlocked: { unitSlug: string; date: string; source: string }[] = [];
  try {
    [propertyBlocked, unitBlocked] = await Promise.all([listBlockedDates(property.id), listUnitBlockedDates(property.id)]);
  } catch (err) {
    console.error("[UnitView] dohvat zauzetih datuma nije uspio:", err);
  }
  const blocked = mergeUnitBlocked(unit.slug, unitBlocked, propertyBlocked);

  const images = unitImages(property, unit);
  const cover = images[0] ?? property.bannerImage ?? property.images[0] ?? null;
  const facts = unitFacts(unit, lang);
  const prices = unitPriceRows(property, unit);
  const minPrice = prices.length > 0 ? Math.min(...prices.map((p) => p.priceEur)) : null;
  const description = pickLang(lang, unit.description, unit.descriptionEn) || property.description;
  const features =
    lang === "en" && unit.featuresEn.length > 0 ? unit.featuresEn : unit.features.length > 0 ? unit.features : property.amenities;
  const others = units.filter((u) => u.slug !== unit.slug);

  const accentStyle = { "--accent": property.accentColor } as React.CSSProperties;
  const contactEmail = property.contactEmail || agency?.contactEmail || "hello@novo.studio";
  const mailHref = `mailto:${contactEmail}?subject=${encodeURIComponent(`Upit — ${unit.name}`)}`;
  const telHref = property.phone ? `tel:${property.phone.replace(/[^\d+]/g, "")}` : null;
  const waHref = property.phone
    ? `https://wa.me/${whatsAppNumber(property.phone)}?text=${encodeURIComponent(`Pozdrav! Imam upit za ${unit.name}.`)}`
    : null;

  const factRows = [
    unit.sizeM2 ? { label: L("Površina", "Size"), value: `${unit.sizeM2} m²` } : null,
    unit.bedrooms ? { label: L("Spavaće sobe", "Bedrooms"), value: String(unit.bedrooms) } : null,
    unit.bathrooms ? { label: L("Kupaonice", "Bathrooms"), value: lang === "en" ? unit.bathrooms.replace(",", ".") : unit.bathrooms } : null,
    unit.guests ? { label: L("Gosti", "Guests"), value: `${L("do", "up to")} ${unit.guests}` } : null,
    { label: L("Lokacija", "Location"), value: property.location },
  ].filter((x): x is { label: string; value: string } => x !== null);

  const navLinks = [
    { href: "#o-apartmanu", label: L("O apartmanu", "About") },
    images.length > 1 && { href: "#fotografije", label: L("Fotografije", "Photos") },
    features.length > 0 && { href: "#karakteristike", label: L("Karakteristike", "Features") },
    prices.length > 0 && { href: "#cijene", label: L("Cijene", "Prices") },
    { href: "#dostupnost", label: L("Dostupnost", "Availability") },
    { href: "#upit", label: L("Kontakt", "Contact") },
  ].filter(Boolean) as { href: string; label: string }[];

  let sectionNo = 0;
  const eyebrowNo = () => String(++sectionNo).padStart(2, "0");

  return (
    <div className={`stay stay-grand stay-unit-page${property.darkMode ? " stay-dark" : ""}`} style={accentStyle}>
      <StayInteractions />

      <section className="stay-grand-intro stay-unit-intro">
        {cover && (
          <div className="stay-grand-intro-media">
            <Image src={cover} alt={`${unit.name} — ${property.location}`} fill sizes="100vw" priority fetchPriority="high" data-parallax />
          </div>
        )}
        <div className="stay-grand-intro-scrim" aria-hidden="true" />
        <div className="stay-grand-intro-content">
          <Link href={links.home} className="stay-unit-back">
            ← {property.name}
          </Link>
          <div className="stay-grand-intro-loc">{property.location}</div>
          <h1 className="stay-grand-intro-mark">{unit.name}</h1>
          {facts.length > 0 && <p className="stay-grand-intro-tagline">{facts.join(" · ")}</p>}
        </div>
      </section>

      <header className="stay-nav">
        <Link href={links.home} className="stay-unit-home" aria-label={property.name}>
          <NavBrand logoUrl={property.logoUrl} showNovoBranding={property.showNovoBranding} name={property.name} />
        </Link>
        <nav className="stay-nav-links" aria-label={L("Navigacija po stranici", "Page navigation")}>
          <Link href={links.home}>← {L("Svi apartmani", "All apartments")}</Link>
          {navLinks.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="stay-nav-right">
          <a className="stay-lang-switch" href={links.unitIn(lang === "en" ? "hr" : "en", unit.slug)}>
            {lang === "en" ? "HR" : "EN"}
          </a>
          <a className="stay-nav-cta" href="#upit" data-magnetic>
            {L("Pošaljite upit", "Send an inquiry")}
          </a>
        </div>
      </header>

      <RevealSection className="stay-section stay-about" id="o-apartmanu">
        <h2 className="stay-eyebrow">
          <span className="stay-eyebrow-no">{eyebrowNo()}</span>
          {L("O apartmanu", "About the apartment")}
        </h2>
        <div className="stay-grand-about">
          <dl className="stay-grand-facts">
            {factRows.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p>{description}</p>
        </div>
      </RevealSection>

      {images.length > 1 && (
        <RevealSection className="stay-section" id="fotografije">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>
            {L("Fotografije", "Photos")}
          </h2>
          <div className="stay-unit">
            <GalleryLightbox images={images} alt={unit.name} />
          </div>
        </RevealSection>
      )}

      {features.length > 0 && (
        <RevealSection className="stay-section stay-alt" id="karakteristike">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>
            {L("Karakteristike", "Features")}
          </h2>
          <div className="stay-amenities">
            {features.map((a) => (
              <div className="stay-amenity" key={a}>
                <AmenityIcon label={a} />
                <span>{a}</span>
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      {prices.length > 0 && (
        <RevealSection className="stay-section" id="cijene">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>
            {L("Cijene", "Prices")}
          </h2>
          <div className="stay-season-table">
            {prices.map((r, i) => (
              <div className="stay-season-row" key={r.season + i}>
                <span>{r.season || L("Cijena", "Price")}</span>
                <span className="stay-season-price">
                  {r.priceEur} € {L("/ noć", "/ night")}
                </span>
              </div>
            ))}
          </div>
        </RevealSection>
      )}

      <RevealSection className="stay-section" id="dostupnost">
        <h2 className="stay-eyebrow">
          <span className="stay-eyebrow-no">{eyebrowNo()}</span>
          {L("Dostupnost", "Availability")} — {unit.name}
        </h2>
        <div className="stay-unit-avail">
        <div className="stay-units-cals stay-units-cals-single">
          <div className="stay-units-cal">
            <AvailabilityCalendar blockedDates={blocked} lang={lang} label={unit.name} />
          </div>
        </div>
        <div className="stay-book">
          <div>
            <div className="price">
              {minPrice != null ? (
                <>
                  {L("od", "from")} {minPrice} € <small>{L("/ noćenje", "/ night")}</small>
                </>
              ) : (
                unit.name
              )}
            </div>
            <p>{L("Odgovaramo unutar 24h", "We reply within 24h")}</p>
          </div>
          <div className="stay-book-actions">
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
            <a className="bookbtn" href="#upit" data-magnetic>
              {L("Pošaljite upit", "Send an inquiry")}
            </a>
          </div>
        </div>
        </div>
      </RevealSection>

      {others.length > 0 && (
        <RevealSection className="stay-section stay-alt">
          <h2 className="stay-eyebrow">
            <span className="stay-eyebrow-no">{eyebrowNo()}</span>
            {L("Pogledajte i", "Also available")}
          </h2>
          <div className="stay-unit-cards">
            {others.map((o) => {
              const oCover = unitImages(property, o)[0] ?? null;
              return (
                <Link className="stay-unit-card2" href={links.unit(o.slug)} key={o.slug}>
                  {oCover && (
                    <div className="stay-unit-card2-media">
                      <Image src={oCover} alt={o.name} fill sizes="(min-width: 900px) 50vw, 100vw" />
                    </div>
                  )}
                  <div className="stay-unit-card2-body">
                    <h3>{o.name}</h3>
                    <p className="stay-unit-facts">{unitFacts(o, lang).join(" · ")}</p>
                    <span className="stay-unit-more">{L("Pogledajte apartman", "View apartment")} →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </RevealSection>
      )}

      <RevealSection className="stay-section stay-alt" id="upit">
        <h2 className="stay-eyebrow">
          <span className="stay-eyebrow-no">{eyebrowNo()}</span>
          {L("Pošaljite upit", "Send an inquiry")}
        </h2>
        <div className="stay-grand-contact">
          <div className="stay-grand-contact-info">
            <p className="stay-grand-contact-lead">
              {L(
                "Odaberite termin u kalendaru iznad ili nam pišite — odgovaramo unutar 24 sata.",
                "Pick your dates in the calendar above or write to us — we reply within 24 hours."
              )}
            </p>
            <ul>
              {telHref && property.phone && (
                <li>
                  <span>{L("Telefon", "Phone")}</span>
                  <a href={telHref}>{property.phone}</a>
                </li>
              )}
              <li>
                <span>Email</span>
                <a href={mailHref}>{contactEmail}</a>
              </li>
            </ul>
          </div>
          <InquiryForm source="property" sourceId={property.id} sourceName={`${property.name} — ${unit.name}`} lang={lang} />
        </div>
      </RevealSection>

      <footer className="stay-foot" data-watermark={property.name}>
        {unit.name} · {property.location}
        <div className="credit">
          {L("Stranicu pokreće", "Site by")} <Link href="/">NOVO</Link>
        </div>
      </footer>

      <div className="stay-mobile-cta">
        <a href="#upit">{L("Pošaljite upit", "Send an inquiry")}</a>
      </div>
    </div>
  );
}

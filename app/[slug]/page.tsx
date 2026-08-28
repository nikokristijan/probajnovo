import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPropertyBySlug } from "@/lib/db/queries";

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
                          const property = await getPropertyBySlug(slug);

                          if (!property || !property.published) {
                          notFound();
                          }

                          const accentStyle = { "--accent": property.accentColor } as React.CSSProperties;

                          return (
                          <div className="stay" style={accentStyle}>
                          <div className="stay-hero">
                          <div className="loc">{property.location}</div>
                          <h1>{property.name}</h1>
                          <p>{property.tagline}</p>
                          </div>

                          <div className="stay-stats">
                          <div className="stay-stat">{property.capacityGuests} gostiju</div>
                          <div className="stay-stat">{property.bedrooms} spavaće sobe</div>
                          <div className="stay-stat">{property.distanceFromCenter}</div>
                          <div className="stay-stat">od {property.priceFromEur} €/noć</div>
                          </div>

                          <div className="stay-section stay-about">
                          <p>{property.description}</p>
                          </div>

                          {property.amenities.length > 0 && (
                          <div className="stay-section stay-alt">
                          <h2 style={{ fontSize: 20, fontWeight: 600 }}>Sadržaji</h2>
                          <div className="stay-amenities">
                          {property.amenities.map((a) => (
                          <div className="stay-amenity" key={a}>
                          {a}
                          </div>
                          ))}
                          </div>
                          </div>
                          )}

                          <div className="stay-section">
                          <div className="stay-book">
                          <div>
                          <div className="price">
                          {property.priceFromEur} € <small>/ noćenje</small>
                          </div>
                          <p>Odgovaramo unutar 24h</p>
                          </div>
                          <a className="bookbtn" href={`mailto:hello@novo.studio?subject=Upit — ${property.name}`}>
                          Pošaljite upit
                          </a>
                          </div>
                          </div>

                          <footer className="stay-foot">
                          {property.name} · {property.location}
                          <div className="credit">
                          Stranicu pokreće <a href="/">novo.hr</a>
                          </div>
                          </footer>
                          </div>
                          );
                          }
                          

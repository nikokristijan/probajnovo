import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Singleton row (id = 1) holding the editable text for the NOVO
 * agency homepage. Everything an admin can change from /admin lives here.
 */
export const agency = pgTable("agency", {
  id: serial("id").primaryKey(),
  heroTitle: text("hero_title").notNull(),
  officeText: text("office_text").notNull(),
  contactEmail: text("contact_email").notNull(),
  instagramHandle: text("instagram_handle").notNull(),
  city: text("city").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Testimonial = { author: string; text: string; rating: number };
export type FaqItem = { question: string; answer: string };
export type SeasonalPrice = { label: string; priceEur: number };
export type ServiceItem = { name: string; description: string; priceEur: number | null };

/**
 * One row per vikendica (holiday cottage) site, served at /[slug].
 * Each property can carry its own accent color so it doesn't have to
 * look like NOVO's own brand — only the URL ties it back.
 */
export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
  priceFromEur: integer("price_from_eur").notNull(),
  capacityGuests: integer("capacity_guests").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  distanceFromCenter: text("distance_from_center").notNull(),
  accentColor: text("accent_color").notNull().default("#B5502E"),
  /** Galerija slika (URL-ovi na Vercel Blob), redoslijed = redoslijed prikaza. */
  images: jsonb("images").$type<string[]>().notNull().default([]),
  /** Naslovna/banner slika za vrh stranice vikendice i za STUDIES pop-up. Null = koristi prvu iz images. */
  bannerImage: text("banner_image"),
  /** Email na koji ide "Kontaktirajte nas" za OVU vikendicu. Null = koristi agency.contactEmail. */
  contactEmail: text("contact_email"),
  published: boolean("published").notNull().default(true),
  /** Ako je true, vikendica se pojavljuje i u STUDIES popisu na naslovnici (opt-in, ne automatski). */
  showInStudies: boolean("show_in_studies").notNull().default(false),
  /** Vizualni layout stranice vikendice: "classic" | "editorial" | "raw" | "apple". */
  layoutStyle: text("layout_style").notNull().default("classic"),
  /** Tamna varijanta boja za stranicu vikendice. */
  darkMode: boolean("dark_mode").notNull().default(false),
  /** Vrijeme prijave/odjave, slobodan tekst (npr. "15:00"). Null = ne prikazuje se. */
  checkInTime: text("check_in_time"),
  checkOutTime: text("check_out_time"),
  /** Kućni red — jedan po retku, kao amenities. */
  houseRules: jsonb("house_rules").$type<string[]>().notNull().default([]),
  /** Ime domaćina i osobna poruka gostima (opcionalno, za osobniji dojam). */
  hostName: text("host_name"),
  hostNote: text("host_note"),
  /** Poveznica na Google Maps (ili sličnu) za prikaz lokacije. */
  mapUrl: text("map_url"),
  /** Izjave/recenzije gostiju — kartice s imenom, tekstom i ocjenom 1-5. */
  testimonials: jsonb("testimonials").$type<Testimonial[]>().notNull().default([]),
  /** Često postavljana pitanja — prikazuju se kao harmonika (accordion). */
  faq: jsonb("faq").$type<FaqItem[]>().notNull().default([]),
  /** Kategorija po slici iz `images` (url → naziv kategorije npr. "Interijer"), za grupiranu galeriju. */
  imageCategories: jsonb("image_categories").$type<Record<string, string>>().notNull().default({}),
  /** Poveznica na video ili virtualnu šetnju (YouTube, Vimeo, Matterport i sl.). */
  videoUrl: text("video_url"),
  /** Sezonski cjenik — ako je popunjen, prikazuje se tablica cijena po sezoni. */
  seasonalPricing: jsonb("seasonal_pricing").$type<SeasonalPrice[]>().notNull().default([]),
  /** Poveznica na vanjski kalendar dostupnosti (Booking.com, Airbnb i sl.). */
  availabilityUrl: text("availability_url"),
  /** Fotografija domaćina za karticu "Domaćin". */
  hostPhoto: text("host_photo"),
  /** Kratke oznake povjerenja — jedna po retku (npr. "4.9 na Google recenzijama"). */
  reviewBadges: jsonb("review_badges").$type<string[]>().notNull().default([]),
  /** Favicon vikendice (URL na Vercel Blob) — tab-ikona u pregledniku. Null = koristi NOVO logo (favicon-orange.png). */
  faviconUrl: text("favicon_url"),
  /** Vlastita domena (npr. "vila-marija.com") umjesto <slug>.novo.hr. Null = nema.
      Ovo polje samo bilježi namjeru vlasnika — stvarno povezivanje domene (dodavanje
      na Vercel + CNAME kod vlasnikovog DNS registratora) radi se ručno, izvan ove app. */
  customDomain: text("custom_domain").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Jedan red po firmi/obrtu — puna vlastita stranica poput vikendice (properties),
 * samo bez booking polja (cijena/noć, gosti, sobe, sezonski cjenik, dostupnost).
 * Dijeli JEDAN plošni /[slug] URL prostor s properties (vikendicama) — isti slug
 * ne smije postojati u obje tablice, jer poddomena/custom-domena sustav radi
 * bez baze u middlewareu (samo <slug> → /<slug>), pa i firma i vikendica na kraju
 * moraju biti dohvatljive na istoj adresi "probajnovo.com/<slug>" odnosno
 * "<slug>.probajnovo.com" — middleware ne zna (i ne treba znati) je li iza toga
 * vikendica ili firma, to razlučuje sama /[slug] stranica pokušavajući prvo
 * properties pa onda companies.
 */
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** Mjesto/regija prikazano uz naziv, npr. "Slavonski Brod · Slavonija". */
  location: text("location").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  /** Usluge/proizvodi — naziv, opis (opcionalan) i cijena (opcionalna, null = "na upit"). */
  services: jsonb("services").$type<ServiceItem[]>().notNull().default([]),
  /** Radno vrijeme — slobodan tekst, po želji jedan redak po danu. Null = ne prikazuje se. */
  workingHours: text("working_hours"),
  phone: text("phone"),
  /** Puna adresa (ulica, mjesto) za kontakt sekciju — odvojeno od kraćeg `location` prikaza uz naslov. */
  address: text("address"),
  instagramUrl: text("instagram_url"),
  facebookUrl: text("facebook_url"),
  accentColor: text("accent_color").notNull().default("#B5502E"),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  bannerImage: text("banner_image"),
  contactEmail: text("contact_email"),
  published: boolean("published").notNull().default(true),
  layoutStyle: text("layout_style").notNull().default("classic"),
  darkMode: boolean("dark_mode").notNull().default(false),
  mapUrl: text("map_url"),
  testimonials: jsonb("testimonials").$type<Testimonial[]>().notNull().default([]),
  faq: jsonb("faq").$type<FaqItem[]>().notNull().default([]),
  imageCategories: jsonb("image_categories").$type<Record<string, string>>().notNull().default({}),
  videoUrl: text("video_url"),
  reviewBadges: jsonb("review_badges").$type<string[]>().notNull().default([]),
  faviconUrl: text("favicon_url"),
  customDomain: text("custom_domain").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Opći portfolio unos agencije (brend identitet, digitalni dizajn, film...).
 * Odvojeno od `properties` (vikendica) jer nema booking-specifična polja
 * (cijena, gosti, sobe, kontakt) niti vlastitu stranicu — prikazuje se
 * samo kao redak u STUDIES popisu i pop-up prozoru sa slikama i opisom.
 */
export const studies = pgTable("studies", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  /** Kratka kategorija/lokacija prikazana u STUDIES popisu, npr. "Brend identitet". */
  category: text("category").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  year: integer("year").notNull(),
  /** Galerija slika (URL-ovi na Vercel Blob) kroz koje se lista u pop-up prozoru. */
  images: jsonb("images").$type<string[]>().notNull().default([]),
  /** Opcionalna vanjska poveznica (npr. klijentova stranica). Null = nema linka. */
  externalUrl: text("external_url"),
  published: boolean("published").notNull().default(true),
  /** Ručni redoslijed unutar STUDIES popisa (manji broj = prvo). */
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Fizički proizvodi agencije (npr. 3D printane pločice s NFC oznakama za
 * spajanje vikendica/firmi na internet i Google recenzije). Nema online
 * plaćanja — posjetitelj šalje upit mailom izravno s NOVO stranice.
 */
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  /** Cijena u eurima (okvirna, "od"). Null = prikazuje se "na upit". */
  priceEur: integer("price_eur"),
  /** Galerija slika (URL-ovi na Vercel Blob). */
  images: jsonb("images").$type<string[]>().notNull().default([]),
  /** Kratke značajke — jedna po retku, prikazane kao chipovi (npr. "NFC oznaka", "Vodootporno"). */
  features: jsonb("features").$type<string[]>().notNull().default([]),
  published: boolean("published").notNull().default(true),
  /** Ručni redoslijed unutar popisa (manji broj = prvo). */
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** Glavni admin — jedini koji može dodavati/micati druge admine. */
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Agency = typeof agency.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Study = typeof studies.$inferSelect;
export type NewStudy = typeof studies.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;

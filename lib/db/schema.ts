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
  /** Vizualni layout stranice vikendice: "classic" | "editorial" | "raw". */
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
export type Study = typeof studies.$inferSelect;
export type NewStudy = typeof studies.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;

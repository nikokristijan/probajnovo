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
  /** Email na koji ide "Kontaktirajte nas" za OVU vikendicu (isti email prima i obavijest o
      novom upitu). Null = koristi agency.contactEmail. */
  contactEmail: text("contact_email"),
  /** Telefon vlasnika/domaćina — omogućuje "Nazovite" i WhatsApp gumb na stranici vikendice. Null = gumbi se ne prikazuju. */
  phone: text("phone"),
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
  /** Puna adresa (ulica, mjesto) — koristi se za automatsko geokodiranje (vidi lib/geocode.ts)
      i prikaz ugrađene OpenStreetMap karte na stranici vikendice. Null = karta se ne prikazuje
      (osim ako je mapUrl postavljen, tad se prikazuje samo poveznica "Otvori na karti"). */
  address: text("address"),
  /** Koordinate dobivene automatskim geokodiranjem `address` polja (best-effort, vidi
      lib/geocode.ts) — spremaju se kao tekst radi jednostavnosti (koriste se samo za
      sastavljanje OpenStreetMap embed URL-a, ne za matematiku). */
  latitude: text("latitude"),
  longitude: text("longitude"),
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
  /** iCal export link (Booking.com/Airbnb "Export Calendar") za automatsko povlačenje
      zauzetih datuma — vidi lib/ical.ts i app/api/cron/sync-ical. Null = nema auto-sync-a,
      kalendar u adminu tad prikazuje samo ručno unesene blokirane datume. */
  icalUrl: text("ical_url"),
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

/**
 * Upit poslan putem javnog obrasca na stranici vikendice/firme (ili s
 * agencijske naslovnice). `sourceName` je snimka naziva u trenutku slanja —
 * upit nije FK-om vezan na properties/companies jer izvor može biti i
 * "agency" (bez retka u ijednoj tablici), a poruka treba ostati čitljiva i
 * ako se vikendica/firma kasnije obriše ili joj se promijeni naziv.
 */
export const inquiries = pgTable("inquiries", {
  id: serial("id").primaryKey(),
  /** "property" | "company" | "agency" */
  source: text("source").notNull(),
  /** properties.id ili companies.id — null kad je source "agency". */
  sourceId: integer("source_id"),
  sourceName: text("source_name").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  /** Ručno označeno u adminu kad vlasnik odgovori gostu izvan sustava (mail/telefon). */
  replied: boolean("replied").notNull().default(false),
  /** IP adresa pošiljatelja (iz x-forwarded-for) — samo za jednostavan rate-limit protiv spama, ne prikazuje se nigdje. */
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Keširan automatski (DeepL) prijevod vikendice na engleski, dostupan na
 * /en/[slug]. Jedan red po vikendici — `sourceHash` je hash hrvatskog
 * teksta korištenog za prijevod; kad admin promijeni opis/sadržaje/itd.,
 * hash se ne poklapa pa se red tiho ponovno prevede i prepiše (vidi
 * lib/translate.ts). Samo polja koja gost stvarno čita kao slobodan tekst —
 * ime, lokacija, cijena, recenzije (ostaju izvorne) i sl. NISU ovdje.
 */
export const propertyTranslationsEn = pgTable("property_translations_en", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().unique(),
  sourceHash: text("source_hash").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  amenities: jsonb("amenities").$type<string[]>(),
  houseRules: jsonb("house_rules").$type<string[]>(),
  faq: jsonb("faq").$type<{ question: string; answer: string }[]>(),
  hostNote: text("host_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** Glavni admin — jedini koji može dodavati/micati druge admine. */
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  /** "admin" = puni pristup (kao dosad), "owner" = vlasnik vikendice/firme —
      vidi lib/auth.ts requireFullAdmin() i lib/actions.ts assertPropertyAccess/
      assertCompanyAccess. Vlasnik smije samo gledati upite i kalendar SVOJIH
      vikendica/firmi (dodijeljenih preko admin_access), ne smije ništa uređivati. */
  role: text("role").notNull().default("admin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Koje vikendice/firme smije gledati koji vlasnički (role="owner") admin_users
 * redak — jedan red po dodijeljenoj vikendici/firmi, admin može imati više
 * redaka (više vikendica odjednom). Točno jedno od propertyId/companyId je
 * postavljeno po retku. Puni adminima (role="admin") se ne provjerava ova
 * tablica — oni imaju pristup svemu.
 */
export const adminAccess = pgTable("admin_access", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  propertyId: integer("property_id"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Blokirani datumi po vikendici za "Kalendar" u adminu (vidi app/admin/kalendar).
 * source "manual" = ručno kliknuto u adminu/kalendaru (admin ili vlasnik te
 * vikendice); source "ical" = automatski povučeno iz properties.icalUrl (vidi
 * lib/ical.ts + app/api/cron/sync-ical) — ical redci se brišu i ponovno
 * upisuju pri svakom sync-u, ručni redci se ne diraju.
 */
export const propertyBlockedDates = pgTable("property_blocked_dates", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  /** "YYYY-MM-DD", jedan red po blokiranom danu (jednostavnije za upit/UI nego raspon). */
  date: text("date").notNull(),
  /** "manual" | "ical" | "reservation" — vidi lib/db/queries.ts createReservation/deleteReservation. */
  source: text("source").notNull().default("manual"),
  /** Postavljeno samo kad je source "reservation" — omogućuje brisanje TOČNO onih blokiranih
      dana koji pripadaju jednoj rezervaciji (vidi reservations tablicu ispod) kad se ta
      rezervacija obriše, bez diranja ručnih/ical redaka za iste datume. */
  reservationId: integer("reservation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Puna knjiga rezervacija po vikendici — zamjena za vlasnikovu bilježnicu
 * (vidi app/admin/rezervacije). Vlasnik ručno upisuje gosta, datume i cijenu;
 * `paid` označava je li vlasnik stvarno naplatio — SAMO plaćene rezervacije
 * ulaze u "zaradu ovaj mjesec" na dashboardu (vidi lib/db/queries.ts
 * getMonthlyEarnings). Obračun je na gotovinskoj bazi: broji se MJESEC U
 * KOJEM JE OZNAČENO PLAĆENO (paidAt), NE mjesec dolaska/odlaska gosta — npr.
 * rezervacija za sljedeći mjesec plaćena unaprijed danas ulazi u OVOMJESEČNU
 * zaradu, jer je novac stvarno stigao sad (vlasnikovo pravilo: "kad oznaci
 * da je placeno uracuna se u zaradu"). Kreiranje rezervacije automatski
 * blokira datume boravka u property_blocked_dates (source "reservation")
 * da se poklapa s kalendarom.
 */
export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  guestName: text("guest_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  /** "YYYY-MM-DD", isti format kao property_blocked_dates.date. */
  checkIn: text("check_in").notNull(),
  checkOut: text("check_out").notNull(),
  priceEur: integer("price_eur").notNull(),
  /** Je li vlasnik stvarno naplatio — vidi komentar gore, presudno za obračun zarade. */
  paid: boolean("paid").notNull().default(false),
  /** Kad je zadnji put označeno plaćenim (postavlja se u setReservationPaid/
      createReservation) — mjerodavno za "u kojem mjesecu ulazi u zaradu",
      ne checkIn. Null dok nije (još) plaćeno. */
  paidAt: timestamp("paid_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Opcionalni troškovi po vikendici (čišćenje, održavanje i sl.) — vlasnik ih
 * ne mora koristiti, ali ako ih unese, dashboard prikazuje i neto zaradu
 * (bruto od plaćenih rezervacija − troškovi tog mjeseca). Vidi
 * lib/db/queries.ts getMonthlyEarnings.
 */
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  description: text("description").notNull(),
  amountEur: integer("amount_eur").notNull(),
  /** "YYYY-MM-DD" */
  date: text("date").notNull(),
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
export type AdminAccess = typeof adminAccess.$inferSelect;
export type PropertyBlockedDate = typeof propertyBlockedDates.$inferSelect;
export type Inquiry = typeof inquiries.$inferSelect;
export type NewInquiry = typeof inquiries.$inferInsert;
export type PropertyTranslationEn = typeof propertyTranslationsEn.$inferSelect;
export type NewPropertyTranslationEn = typeof propertyTranslationsEn.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

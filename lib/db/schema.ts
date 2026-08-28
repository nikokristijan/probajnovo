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
published: boolean("published").notNull().default(true),
createdAt: timestamp("created_at").defaultNow().notNull(),
updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminUsers = pgTable("admin_users", {
id: serial("id").primaryKey(),
email: text("email").notNull().unique(),
passwordHash: text("password_hash").notNull(),
createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Agency = typeof agency.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;

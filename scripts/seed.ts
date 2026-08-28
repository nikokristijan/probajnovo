/**
* Pokreni jednom nakon prve migracije: npm run db:seed
* Kreira agencijski redak, prvi admin račun (iz .env) i primjer vikendice.
* Siguran za ponovno pokretanje — preskače ono što već postoji.
*/
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { agency, adminUsers, properties } from "../lib/db/schema";

async function main() {
const existingAgency = await db.select().from(agency).limit(1);
if (existingAgency.length === 0) {
await db.insert(agency).values({
id: 1,
heroTitle:
"NOVO is a creative agency working across brand identity, digital design, and film.",
officeText:
"NOVO is based in Slavonski Brod, working toward Osijek and beyond. We build things with a distinct visual identity — for people who care how something looks, feels, and opens.",
contactEmail: "hello@novo.studio",
instagramHandle: "@novo.hr",
city: "Slavonski Brod, Croatia",
});
console.log("✓ Agencijski sadržaj kreiran.");
} else {
console.log("– Agencijski sadržaj već postoji, preskačem.");
}

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
console.log(
"! ADMIN_EMAIL / ADMIN_PASSWORD nisu postavljeni u .env — admin račun nije kreiran."
);
} else {
const existing = await db
.select()
.from(adminUsers)
.where(eq(adminUsers.email, adminEmail))
.limit(1);
if (existing.length === 0) {
const passwordHash = await bcrypt.hash(adminPassword, 12);
await db.insert(adminUsers).values({ email: adminEmail, passwordHash });
console.log(`✓ Admin račun kreiran za ${adminEmail}.`);
} else {
console.log("– Admin račun s tim emailom već postoji, preskačem.");
}
}

const existingProperty = await db
.select()
.from(properties)
.where(eq(properties.slug, "sokak-bez-imena"))
.limit(1);
if (existingProperty.length === 0) {
await db.insert(properties).values({
slug: "sokak-bez-imena",
name: "Sokak bez imena",
location: "Slavonski Brod · Slavonija",
tagline: "Stara brodska kuća, novi mir.",
description:
"Obiteljska kuća od opeke iz 1920-ih, obnovljena tako da je zadržala trijem, drvene kapke i visoke stropove. Nalazi se u mirnom sokaku — uskoj ulici između vrtova.\n\nU vrtu raste stogodišnji orah pod kojim stoji stol za večere do kasno, a deset minuta hoda vodi do keja uz Savu.",
amenities: [
"Besplatan WiFi",
"Parking na posjedu",
"Vrt s roštiljem",
"Klima uređaj",
"Ljetna kuhinja",
"Blizina rijeke Save",
"Kućni ljubimci dobrodošli",
"Pogled na polja",
],
priceFromEur: 78,
capacityGuests: 6,
bedrooms: 3,
distanceFromCenter: "1,2 km od centra",
accentColor: "#B5502E",
published: true,
});
console.log("✓ Primjer vikendice 'Sokak bez imena' kreiran.");
} else {
console.log("– 'Sokak bez imena' već postoji, preskačem.");
}

console.log("\nGotovo.");
process.exit(0);
}

main().catch((err) => {
console.error(err);
process.exit(1);
});

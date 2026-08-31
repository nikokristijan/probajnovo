import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { getPropertyById, hasAdminAccess, listReservationsForProperty } from "@/lib/db/queries";

/** Isto pravilo za CSV polje kao standardni CSV escaping: ako sadrži zarez,
    navodnik ili novi red, omotaj u navodnike i udvostruči unutarnje navodnike. */
function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(",") + "\r\n";
}

/**
 * Izvoz rezervacija JEDNE vikendice kao CSV (za "Izvezi CSV" gumb na
 * /admin/rezervacije) — isti obrazac kao app/api/admin/inquiries/export, samo
 * po vikendici (?property=ID) jer je i sama stranica Rezervacije uvijek
 * scoped na jednu vikendicu odjednom. Vlasnik smije izvesti samo dodijeljenu
 * vikendicu — ista provjera kao assertPropertyAccess u lib/actions.ts.
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdminRecord();
  if (!admin) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const propertyId = Number(new URL(req.url).searchParams.get("property"));
  if (!propertyId) {
    return NextResponse.json({ error: "Nedostaje ?property=" }, { status: 400 });
  }
  if (admin.role === "owner" && !(await hasAdminAccess(admin.id, { propertyId }))) {
    return NextResponse.redirect(new URL("/admin/inquiries", req.url));
  }

  const property = await getPropertyById(propertyId);
  const reservations = await listReservationsForProperty(propertyId);

  let csv = csvRow([
    "Gost",
    "Telefon",
    "Email",
    "Dolazak",
    "Odlazak",
    "Cijena (EUR)",
    "Plaćeno",
    "Napomena",
  ]);
  for (const r of reservations) {
    csv += csvRow([
      r.guestName,
      r.phone ?? "",
      r.email ?? "",
      r.checkIn,
      r.checkOut,
      String(r.priceEur),
      r.paid ? "da" : "ne",
      r.note ?? "",
    ]);
  }

  // UTF-8 BOM na početku da Excel ispravno prepozna kodiranje (isto kao
  // app/api/admin/inquiries/export).
  const body = "\uFEFF" + csv;
  const slugPart = property?.slug ?? String(propertyId);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rezervacije-${slugPart}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

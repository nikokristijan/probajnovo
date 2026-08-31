import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { getPropertyById, hasAdminAccess, listReservationsForProperty } from "@/lib/db/queries";

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
 * Godišnji izvještaj rezervacija JEDNE vikendice kao CSV (za "Godišnji
 * izvještaj" gumb na /admin/rezervacije) — isti obrazac kao
 * app/api/admin/reservations/export, samo filtrirano na jednu ?year=.
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdminRecord();
  if (!admin) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get("property"));
  const year = url.searchParams.get("year") || new Date().getFullYear().toString();
  if (!propertyId) {
    return NextResponse.json({ error: "Nedostaje ?property=" }, { status: 400 });
  }
  if (admin.role === "owner" && !(await hasAdminAccess(admin.id, { propertyId }))) {
    return NextResponse.redirect(new URL("/admin/inquiries", req.url));
  }

  const property = await getPropertyById(propertyId);
  const allReservations = await listReservationsForProperty(propertyId);
  const reservations = allReservations.filter((r) => r.checkIn.startsWith(year));

  let csv = csvRow([
    "Gost",
    "Broj gostiju",
    "Telefon",
    "Email",
    "Dolazak",
    "Odlazak",
    "Cijena (EUR)",
    "Kapara (EUR)",
    "Plaćeno",
    "Napomena",
  ]);
  for (const r of reservations) {
    csv += csvRow([
      r.guestName,
      r.guestCount != null ? String(r.guestCount) : "",
      r.phone ?? "",
      r.email ?? "",
      r.checkIn,
      r.checkOut,
      String(r.priceEur),
      r.depositEur != null ? String(r.depositEur) : "",
      r.paid ? "da" : "ne",
      r.note ?? "",
    ]);
  }

  const body = "﻿" + csv;
  const slugPart = property?.slug ?? String(propertyId);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rezervacije-${slugPart}-${year}.csv"`,
    },
  });
}

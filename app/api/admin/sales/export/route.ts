import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listSales } from "@/lib/db/queries";

/** Isto pravilo za CSV polje kao standardni CSV escaping. */
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
 * Izvoz SVIH prodaja agencije kao CSV (za "Izvezi CSV" gumb na
 * /admin/prodaja) — isti obrazac kao app/api/admin/reservations/export, samo
 * bez ?property= jer prodaja nije vezana uz vikendicu. Samo puni admini —
 * vlasnici nemaju pristup /admin/prodaja uopće.
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdminRecord();
  if (!admin || admin.role === "owner") {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const sales = await listSales();

  let csv = csvRow(["Datum", "Kategorija", "Stavka", "Kupac", "Cijena (EUR)", "Napomena"]);
  for (const s of sales) {
    csv += csvRow([s.date, s.category, s.item, s.buyerName ?? "", String(s.priceEur), s.note ?? ""]);
  }

  // UTF-8 BOM na početku da Excel ispravno prepozna kodiranje.
  const body = "﻿" + csv;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="prodaja-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

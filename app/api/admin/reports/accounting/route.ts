import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { getPropertyById, hasAdminAccess, getAccountingReport } from "@/lib/db/queries";
import { buildAccountingCsv, buildAccountingPdf } from "@/lib/accountingReport";

/**
 * "Izvještaj za knjigovođu" (CSV ili PDF) za JEDNU vikendicu i JEDNU godinu —
 * gumbi na /admin/rezervacije. ?format=csv (zadano) ili ?format=pdf.
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdminRecord();
  if (!admin) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const url = new URL(req.url);
  const propertyId = Number(url.searchParams.get("property"));
  const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  if (!propertyId) {
    return NextResponse.json({ error: "Nedostaje ?property=" }, { status: 400 });
  }
  if (admin.role === "owner" && !(await hasAdminAccess(admin.id, { propertyId }))) {
    return NextResponse.redirect(new URL("/admin/inquiries", req.url));
  }

  const property = await getPropertyById(propertyId);
  if (!property) {
    return NextResponse.json({ error: "Vikendica ne postoji." }, { status: 404 });
  }

  const report = await getAccountingReport(propertyId, year);
  const slugPart = property.slug;

  if (format === "pdf") {
    const pdfBytes = await buildAccountingPdf(property.name, report);
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="izvjestaj-knjigovodstvo-${slugPart}-${year}.pdf"`,
      },
    });
  }

  const csv = buildAccountingCsv(property.name, report);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="izvjestaj-knjigovodstvo-${slugPart}-${year}.csv"`,
    },
  });
}

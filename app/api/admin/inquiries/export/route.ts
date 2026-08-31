import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import { listInquiriesForAdmin } from "@/lib/db/queries";

const SOURCE_LABEL: Record<string, string> = {
  property: "Vikendica",
  company: "Firma",
  agency: "NOVO (agencija)",
};

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
 * Izvoz upita kao CSV (za /admin/inquiries "Izvezi CSV" gumb). Isto skupno
 * pravilo pristupa kao na stranici Upiti: vlasnik (role="owner") dobiva SAMO
 * upite svojih dodijeljenih vikendica/firmi, puni admin dobiva sve.
 */
export async function GET(req: Request) {
  const admin = await getCurrentAdminRecord();
  if (!admin) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const inquiries = await listInquiriesForAdmin(admin);

  let csv = csvRow(["Datum", "Izvor", "Naziv", "Ime", "Email", "Telefon", "Poruka", "Pročitano", "Odgovoreno"]);
  for (const i of inquiries) {
    csv += csvRow([
      new Date(i.createdAt).toLocaleString("hr-HR"),
      SOURCE_LABEL[i.source] ?? i.source,
      i.sourceName,
      i.name,
      i.email,
      i.phone ?? "",
      i.message,
      i.read ? "da" : "ne",
      i.replied ? "da" : "ne",
    ]);
  }

  // UTF-8 BOM na početku da Excel ispravno prepozna kodiranje (inače hrvatska
  // slova č/ć/š/ž/đ ispadnu krivo prikazana kad se CSV otvori u Excelu).
  const body = "\uFEFF" + csv;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="upiti-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

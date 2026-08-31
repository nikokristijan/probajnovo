import { NextResponse } from "next/server";
import { getCurrentAdminRecord } from "@/lib/auth";
import {
  getPropertyById,
  hasAdminAccess,
  listReservationsForProperty,
  listExpensesForProperty,
} from "@/lib/db/queries";

/**
 * "Preuzmi backup (JSON)" gumb na /admin/rezervacije — puni izvoz rezervacija
 * i troškova jedne vikendice, za slučaj da vlasnik/admin želi lokalnu kopiju
 * (vidi "Sigurnost i pregled rada" u zahtjevu). Isti pristupni obrazac kao
 * app/api/admin/reservations/export.
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

  const [property, reservations, expenses] = await Promise.all([
    getPropertyById(propertyId),
    listReservationsForProperty(propertyId),
    listExpensesForProperty(propertyId),
  ]);

  const body = JSON.stringify(
    { property: property?.name ?? null, exportedAt: new Date().toISOString(), reservations, expenses },
    null,
    2
  );
  const slugPart = property?.slug ?? String(propertyId);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup-${slugPart}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

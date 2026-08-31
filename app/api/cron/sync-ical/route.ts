import { NextResponse } from "next/server";
import { getPropertiesWithIcalUrl, replaceIcalBlockedDates } from "@/lib/db/queries";
import { fetchIcalBlockedDates } from "@/lib/ical";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron (vidi vercel.json — jednom dnevno, Hobby plan dopušta samo to)
 * poziva ovaj endpoint da povuče zauzete datume sa svih vikendica koje imaju
 * postavljen icalUrl (Booking.com/Airbnb "Export Calendar" link) i osvježi
 * property_blocked_dates (source="ical") — vidi lib/ical.ts i app/admin/kalendar.
 *
 * Vercel automatski šalje "Authorization: Bearer $CRON_SECRET" na cron-pozive
 * kad je CRON_SECRET postavljen kao env varijabla — provjeravamo ga da ovaj
 * endpoint netko izvana ne može okinuti (i time trošiti Nominatim/Airbnb
 * kvotu ili prebrisati ručne unose neplanirano).
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const properties = await getPropertiesWithIcalUrl();
  const results: { propertyId: number; ok: boolean; count?: number }[] = [];

  for (const property of properties) {
    const dates = await fetchIcalBlockedDates(property.icalUrl);
    if (dates === null) {
      results.push({ propertyId: property.id, ok: false });
      continue;
    }
    await replaceIcalBlockedDates(property.id, dates);
    results.push({ propertyId: property.id, ok: true, count: dates.length });
  }

  return NextResponse.json({ synced: results.length, results });
}

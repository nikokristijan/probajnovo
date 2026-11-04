import { NextResponse } from "next/server";
import { authorizeCron, runCron } from "@/lib/cron";
import { getPropertiesWithIcalUrl, replaceIcalBlockedDates } from "@/lib/db/queries";
import { fetchIcalBlockedDates } from "@/lib/ical";
import { listUnitIcalFeeds, replaceUnitIcalBlockedDates } from "@/lib/db/units";

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
  const denied = authorizeCron(req);
  if (denied) return denied;

  return runCron("sync-ical", async () => {
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

    // Apartmani s vlastitim iCal linkom (lib/db/units.ts) — svaki svoj kalendar.
    const unitResults: { propertyId: number; unit: string; ok: boolean; count?: number }[] = [];
    let unitFeeds: Awaited<ReturnType<typeof listUnitIcalFeeds>> = [];
    try {
      unitFeeds = await listUnitIcalFeeds();
    } catch (err) {
      console.error("[sync-ical] listUnitIcalFeeds nije uspio:", err);
    }
    for (const feed of unitFeeds) {
      const dates = await fetchIcalBlockedDates(feed.icalUrl);
      if (dates === null) {
        unitResults.push({ propertyId: feed.propertyId, unit: feed.unitSlug, ok: false });
        continue;
      }
      await replaceUnitIcalBlockedDates(feed.propertyId, feed.unitSlug, dates);
      unitResults.push({ propertyId: feed.propertyId, unit: feed.unitSlug, ok: true, count: dates.length });
    }

    return NextResponse.json({ synced: results.length, results, units: unitResults });
  });
}

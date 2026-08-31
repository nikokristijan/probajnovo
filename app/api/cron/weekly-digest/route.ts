import { NextResponse } from "next/server";
import { listInquiries, getAgency } from "@/lib/db/queries";
import { sendWeeklyDigest } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron (vidi vercel.json — jednom tjedno, ponedjeljkom ujutro) poziva
 * ovaj endpoint da agenciji (agency.contactEmail) pošalje zbroj upita
 * primljenih u zadnjih 7 dana, grupiran po vikendici/firmi — nadzorni
 * pregled preko svega, za razliku od trenutne obavijesti pojedinom vlasniku
 * po upitu (vidi lib/actions.ts createInquiryAction + lib/email.ts
 * sendInquiryNotification). Isti CRON_SECRET Bearer auth obrazac kao
 * app/api/cron/sync-ical.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [all, agency] = await Promise.all([listInquiries(), getAgency()]);
  const recent = all.filter((i) => i.createdAt >= since);

  const countsBySource = new Map<string, number>();
  for (const inquiry of recent) {
    countsBySource.set(inquiry.sourceName, (countsBySource.get(inquiry.sourceName) ?? 0) + 1);
  }
  const groups = Array.from(countsBySource.entries()).map(([sourceName, count]) => ({
    sourceName,
    count,
  }));

  if (agency) {
    await sendWeeklyDigest({
      to: agency.contactEmail,
      sinceLabel: `${since.toLocaleDateString("hr-HR")} – ${new Date().toLocaleDateString("hr-HR")}`,
      totalCount: recent.length,
      groups,
    });
  }

  return NextResponse.json({ totalCount: recent.length, groups });
}

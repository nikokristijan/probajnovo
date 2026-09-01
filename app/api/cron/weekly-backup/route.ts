import { NextResponse } from "next/server";
import { getFullBackupData, getAgency } from "@/lib/db/queries";
import { sendAdminBackup } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron (vidi vercel.json — jednom tjedno, nedjeljom ujutro) šalje
 * agenciji (agency.contactEmail, isti primatelj kao app/api/cron/weekly-digest)
 * JSON backup rezervacija i troškova svih vikendica u prilogu maila —
 * "Automatski backup" iz zahtjeva, da vlasnik ima kopiju bez da mora ručno
 * skidati "Backup (JSON)" po vikendici sa /admin/rezervacije. Isti
 * CRON_SECRET Bearer auth obrazac kao ostali cron endpointi.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [backup, agency] = await Promise.all([getFullBackupData(), getAgency()]);
  const jsonContent = JSON.stringify(backup, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);

  let sent = false;
  if (agency) {
    sent = await sendAdminBackup({
      to: agency.contactEmail,
      filename: `novo-backup-${dateStr}.json`,
      jsonContent,
      propertyCount: backup.properties.length,
    });
  }

  return NextResponse.json({ propertyCount: backup.properties.length, sent });
}

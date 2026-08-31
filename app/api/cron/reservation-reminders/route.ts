import { NextResponse } from "next/server";
import {
  listReservationsForReminderOn,
  markReservationReminderSent,
  getPropertyById,
} from "@/lib/db/queries";
import { sendReservationReminder } from "@/lib/email";
import { dateStringOffsetFromTodayZagreb } from "@/lib/date";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron (vidi vercel.json — jednom dnevno ujutro) šalje gostima čiji je
 * checkIn SUTRA (po hrvatskom vremenu, vidi lib/date.ts) podsjetnik na
 * dolazak, ako je gostov email upisan i podsjetnik još nije poslan (vidi
 * reservations.reminderSentAt). Isti CRON_SECRET Bearer auth obrazac kao
 * app/api/cron/weekly-digest.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const tomorrow = dateStringOffsetFromTodayZagreb(1);
  const due = await listReservationsForReminderOn(tomorrow);

  let sent = 0;
  for (const r of due) {
    if (!r.email) {
      // Nema email — nema kome poslati, ali ipak označi da je "obrađeno"
      // da cron ne pokušava svaki dan iznova za istu rezervaciju.
      await markReservationReminderSent(r.id);
      continue;
    }
    const property = await getPropertyById(r.propertyId);
    if (!property) continue;
    await sendReservationReminder({
      to: r.email,
      guestName: r.guestName,
      propertyName: property.name,
      checkIn: r.checkIn,
    });
    await markReservationReminderSent(r.id);
    sent++;
  }

  return NextResponse.json({ checked: due.length, sent });
}

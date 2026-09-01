import { NextResponse } from "next/server";
import {
  listReservationsForReminderOn,
  markReservationReminderSent,
  getPropertyById,
} from "@/lib/db/queries";
import { sendReservationReminder } from "@/lib/email";
import { dateStringOffsetFromTodayZagreb } from "@/lib/date";
import { sendPushToAdmins } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron (vidi vercel.json — jednom dnevno ujutro) šalje gostima čiji je
 * checkIn SUTRA (po hrvatskom vremenu, vidi lib/date.ts) podsjetnik na
 * dolazak, ako je gostov email upisan i podsjetnik još nije poslan (vidi
 * reservations.reminderSentAt). Isti CRON_SECRET Bearer auth obrazac kao
 * app/api/cron/weekly-digest. Uz mail gostu, admini dobiju i push obavijest
 * ("Podsjetnik: gost stiže sutra" iz zahtjeva) — NEOVISNO o tome ima li gost
 * upisan email (admin i dalje treba znati da gost stiže, čak i bez maila).
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
    const property = await getPropertyById(r.propertyId);

    if (r.email && property) {
      await sendReservationReminder({
        to: r.email,
        guestName: r.guestName,
        propertyName: property.name,
        checkIn: r.checkIn,
      });
      sent++;
    }

    if (property) {
      await sendPushToAdmins(
        { propertyId: r.propertyId },
        {
          title: "Gost stiže sutra",
          body: `${r.guestName} — ${property.name}`,
          url: "/admin/rezervacije",
        }
      );
    }

    // Označi "obrađeno" u oba slučaja (s mailom ili bez) da cron ne
    // pokušava svaki dan iznova za istu rezervaciju.
    await markReservationReminderSent(r.id);
  }

  return NextResponse.json({ checked: due.length, sent });
}

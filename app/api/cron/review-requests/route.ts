import { NextResponse } from "next/server";
import {
  listReservationsForReviewRequestOn,
  markReservationReviewRequestSent,
  getPropertyById,
} from "@/lib/db/queries";
import { sendReviewRequest } from "@/lib/email";
import { dateStringOffsetFromTodayZagreb } from "@/lib/date";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron (vidi vercel.json — jednom dnevno) šalje gostima čiji je
 * checkOut bio prije 2 dana zamolbu za Google recenziju (koristi
 * property.mapUrl kao poveznicu) — samo ako je gostov email upisan, vikendica
 * ima postavljen mapUrl i zamolba još nije poslana (vidi
 * reservations.reviewRequestSentAt). Isti CRON_SECRET Bearer auth obrazac kao
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

  const checkOutDate = dateStringOffsetFromTodayZagreb(-2);
  const due = await listReservationsForReviewRequestOn(checkOutDate);

  let sent = 0;
  for (const r of due) {
    const property = await getPropertyById(r.propertyId);
    if (!r.email || !property?.mapUrl) {
      // Nema kome poslati ili vikendica nema mapUrl — označi obrađeno da
      // cron ne pokušava svaki dan iznova.
      await markReservationReviewRequestSent(r.id);
      continue;
    }
    await sendReviewRequest({
      to: r.email,
      guestName: r.guestName,
      propertyName: property.name,
      mapUrl: property.mapUrl,
    });
    await markReservationReviewRequestSent(r.id);
    sent++;
  }

  return NextResponse.json({ checked: due.length, sent });
}

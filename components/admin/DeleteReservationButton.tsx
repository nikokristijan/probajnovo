"use client";

import { deleteReservationAction } from "@/lib/actions";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { reservationDeleteDescription, reservationDeleteTitle } from "@/components/admin/reservationConfirmText";

export default function DeleteReservationButton({
  propertyId,
  id,
  guestName,
  checkIn,
  checkOut,
}: {
  propertyId: number;
  id: number;
  guestName: string;
  checkIn?: string;
  checkOut?: string;
}) {
  return (
    <ConfirmSubmit
      action={deleteReservationAction.bind(null, propertyId, id, guestName)}
      title={reservationDeleteTitle(guestName, checkIn, checkOut)}
      description={reservationDeleteDescription(checkIn, checkOut)}
      confirmLabel="Obriši rezervaciju"
      buttonLabel="Obriši"
      buttonClassName="text-xs font-semibold text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50"
    />
  );
}

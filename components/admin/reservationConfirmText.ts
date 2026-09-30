/** Tekst potvrde brisanja rezervacije (plan #58): "Obrisati rezervaciju
    Ana Babić, 3.–8. 10.?" i "Oslobodit će se 5 noći u kalendaru." */
export function reservationDeleteTitle(guestName: string, checkIn?: string, checkOut?: string): string {
  if (!checkIn || !checkOut) return `Obrisati rezervaciju ${guestName}?`;
  const [, inM, inD] = checkIn.split("-").map(Number);
  const [, outM, outD] = checkOut.split("-").map(Number);
  const range = inM === outM ? `${inD}.–${outD}. ${outM}.` : `${inD}. ${inM}.–${outD}. ${outM}.`;
  return `Obrisati rezervaciju ${guestName}, ${range}?`;
}

export function reservationDeleteDescription(checkIn?: string, checkOut?: string): string {
  if (!checkIn || !checkOut) return "Blokirani dani ove rezervacije oslobodit će se u kalendaru.";
  const nights = Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
  const word = nights % 10 === 1 && nights % 100 !== 11 ? "noć" : "noći";
  return `Oslobodit će se ${nights} ${word} u kalendaru. Ovo se ne može poništiti.`;
}

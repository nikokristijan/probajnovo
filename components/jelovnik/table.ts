/**
 * Broj stola iz ?stol=: samo informativan (sprema se uz unos, nigdje se drugdje ne koristi). Prihvaća kratak tekst od
 * slova, znamenki i nekoliko znakova (razmak . _ - /); sve drugo je null. Ista pravila kao u captureGuest.
 */
export function cleanTable(value: string | null | undefined): string | null {
  const t = (value ?? "").trim();
  return /^[\p{L}\p{N} ._\-/]{1,20}$/u.test(t) ? t : null;
}

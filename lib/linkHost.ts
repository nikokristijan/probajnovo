/**
 * Javna adresa dinamičkih NFC linkova (vidi nfcLinks u lib/db/schema.ts).
 *
 * NEXT_PUBLIC_LINK_HOST = neutralna kratka domena bez riječi "novo" (npr.
 * "tapni.hr"), spojena na ISTI Vercel projekt. Na njoj proxy.ts svaki put
 * "/<code>" prepisuje na /k/<code>, a sve ostalo vraća praznu 404 — tako se
 * na toj domeni ne može doći ni do admina ni do NOVO stranica.
 * Dok domena nije postavljena, linkovi rade preko probajnovo.com/k/<code>
 * (ispravno, ali tada se domena probajnovo vidi pri skeniranju).
 */
export const LINK_HOST = (process.env.NEXT_PUBLIC_LINK_HOST ?? "").trim().toLowerCase();

export function publicNfcLinkUrl(code: string): string {
  if (LINK_HOST) return `https://${LINK_HOST}/${code}`;
  const apex = process.env.NEXT_PUBLIC_APEX_HOST || "probajnovo.com";
  return `https://${apex}/k/${code}`;
}

/** Kod u linku: 3–32 znaka, mala slova, brojke i crtica (ne na rubovima). */
export const NFC_LINK_CODE_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

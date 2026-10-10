import "server-only";
import { cache } from "react";
import { verifyGuestCookie } from "@/lib/recenzije/guest-cookie";
import { getPublicMenuBySlug, getPublicMenuInfoBySlug, type PublicMenuInfo } from "@/lib/recenzije/services/menus";

/**
 * Podaci stranice jelovnika. Svaki upit se izvršava najviše jednom po zahtjevu (React cache): layout ih zagrije PRIJE
 * nego što loading.tsx pošalje kostur, a stranica ih samo pročita. To je važno jer React streaming bez JavaScripta
 * nikad ne zamijeni kostur pravim sadržajem: stranica koja bi tek u page.tsx čekala na bazu ne bi radila bez JS-a.
 */

/** Zaglavlje jelovnika po adresi. Nepoznat ili ugašen jelovnik = null. */
export const loadMenuInfo = cache((slug: string) => getPublicMenuInfoBySlug(slug));

/** Cijeli javni jelovnik (kategorije i stavke). */
export const loadMenuContent = cache((slug: string) => getPublicMenuBySlug(slug));

export type Access = "cookie" | "skip" | "gate";

/**
 * Tko smije vidjeti jelovnik: ispravan potpisani kolačić ovog jelovnika, ili (samo ako lokal to dopušta i gost je izričito
 * odabrao "bez unosa broja") preskakanje; inače vrata. Ista pravila kao resolveMenuAccess u services/guests.ts, ali bez
 * dodatnog upita u bazu (zaglavlje je već učitano).
 */
export function decideAccess(info: PublicMenuInfo, cookieValue: string | null | undefined, skip: boolean): Access {
  if (verifyGuestCookie(info.id, cookieValue)) return "cookie";
  if (info.allowSkip && skip) return "skip";
  return "gate";
}

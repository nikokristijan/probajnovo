import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { derivedKey } from "@/lib/recenzije/env";

/**
 * Kolačić "ovaj preglednik je prošao vrata jelovnika" (30 dana, po jelovniku). Sadrži samo id jelovnika, rok i
 * HMAC potpis (ključ izveden iz SESSION_SECRET), nikad broj telefona ni ikakve osobne podatke. Potpis sprječava
 * da netko sam napiše kolačić i preskoči vrata kad je preskakanje isključeno.
 *
 * Postavljanje (u akciji ili ruti, ne u komponenti):
 *   (await cookies()).set(guestCookieName(menu.id), signGuestCookie(menu.id), guestCookieOptions());
 * Čitanje:
 *   verifyGuestCookie(menu.id, (await cookies()).get(guestCookieName(menu.id))?.value)
 */
export const GUEST_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const VERSION = "v1";

/** Ime kolačića je po jelovniku (id je bez posebnih znakova), pa više lokala u istom pregledniku ne smeta jedan drugome. */
export function guestCookieName(menuId: string): string {
  return `nr_gm_${menuId.replace(/[^A-Za-z0-9]/g, "").slice(0, 40)}`;
}

function signature(menuId: string, expiresAtSeconds: number): string {
  return createHmac("sha256", derivedKey("nr-guest-menu")).update(`${VERSION}.${menuId}.${expiresAtSeconds}`).digest("base64url");
}

/** Vrijednost kolačića koja vrijedi 30 dana od `now`. */
export function signGuestCookie(menuId: string, now: number = Date.now()): string {
  const exp = Math.floor(now / 1000) + GUEST_COOKIE_MAX_AGE_SECONDS;
  return `${VERSION}.${exp}.${signature(menuId, exp)}`;
}

/** True samo za neistekao kolačić koji je potpisan za TAJ jelovnik. Neispravan ili tuđi kolačić je jednostavno false. */
export function verifyGuestCookie(menuId: string, value: string | null | undefined, now: number = Date.now()): boolean {
  if (!value || value.length > 200) return false;
  const [version, expRaw, sig, ...extra] = value.split(".");
  if (version !== VERSION || !expRaw || !sig || extra.length > 0 || !/^\d{1,12}$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (exp * 1000 <= now) return false;
  const want = Buffer.from(signature(menuId, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Postavke kolačića: nedostupan skriptama, samo preko https u produkciji, šalje se i pri dolasku s QR koda (lax). */
export function guestCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/jelovnik",
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  };
}

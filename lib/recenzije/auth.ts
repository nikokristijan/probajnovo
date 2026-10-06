import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { derivedKey } from "@/lib/recenzije/env";

/**
 * Prijava za NOVO Recenzije — odvojena od /admin prijave probajnova
 * (drugi kolačić, drugi ključ izveden iz SESSION_SECRET), pa korisnik
 * Recenzija nikad ne dobiva pristup adminu i obrnuto.
 */
const COOKIE = "nr_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dana

const key = () => new Uint8Array(derivedKey("nr-session"));

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

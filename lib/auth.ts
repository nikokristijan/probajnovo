import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getAdminById } from "@/lib/db/queries";

const COOKIE_NAME = "novo_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 dana

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET nije postavljen u environment varijablama.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  adminId: number;
  email: string;
};

/** Potpiše sesiju i vrati JWT string (spreman za stavljanje u kolačić). */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
  .sign(getSecretKey());
}

/** Provjeri JWT i vrati payload, ili null ako je nevažeći/istekao. */
export async function verifySessionToken(
  token: string
  ): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.adminId !== "number" || typeof payload.email !== "string") {
      return null;
    }
    return { adminId: payload.adminId, email: payload.email };
  } catch {
    return null;
  }
}

/** Postavi httpOnly kolačić sa sesijom (poziva se iz Route Handlera / Server Actiona). */
export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Pročitaj i provjeri trenutnu admin sesiju iz kolačića (Server Component / Route Handler). */
export async function getCurrentAdmin(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Pročitaj trenutnu sesiju I puni admin_users redak (uključujući isSuperAdmin). */
export async function getCurrentAdminRecord() {
  const session = await getCurrentAdmin();
  if (!session) return null;
  const row = await getAdminById(session.adminId);
  if (!row) return null;
  return row;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

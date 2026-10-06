import { randomBytes } from "crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Collision-resistant, URL-safe id (25 chars, time-prefixed so ids sort roughly by creation). */
export function createId(): string {
  const time = Date.now().toString(36).padStart(9, "0");
  const bytes = randomBytes(16);
  let rand = "";
  for (const b of bytes) rand += ALPHABET[b % 36];
  return `c${time}${rand}`.slice(0, 25);
}

/** Short random token for public tracking URLs (/r/{token}). ~71 bits of entropy. */
export function createToken(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

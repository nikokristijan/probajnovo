import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";
import { derivedKey, env } from "./env";

/** AES-256-GCM za tajne u bazi (Google tokeni, SMS gateway lozinke). Ključ je izveden iz SESSION_SECRET. */
function key(): Buffer {
  return derivedKey("nr-encryption");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Pozivni kod za registraciju: usporedba bez curenja vremena; bez postavljenih kodova nijedan ne vrijedi. */
export function isValidInviteCode(code: string): boolean {
  const given = sha256(code.trim());
  let ok = false;
  for (const c of env.inviteCodes) if (timingSafeEqual(Buffer.from(sha256(c)), Buffer.from(given))) ok = true;
  return ok;
}

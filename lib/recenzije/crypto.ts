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

/**
 * Pozivni kod iz okruženja (NR_INVITE_CODES), dodatni izvor uz kodove iz baze: usporedba
 * bez curenja vremena (uvijek prolazi kroz sve kodove); bez postavljenih kodova nijedan ne vrijedi.
 */
export function isEnvInviteCode(code: string): boolean {
  const given = Buffer.from(sha256(code.trim()));
  let ok = false;
  for (const c of env.inviteCodes) if (timingSafeEqual(Buffer.from(sha256(c)), given)) ok = true;
  return ok;
}

/** 31 znak: bez 0/O i 1/I/L da se kod bez greške prepiše s poruke ili poziva. */
const INVITE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const INVITE_BODY_LENGTH = 8;
const INVITE_SHAPE = new RegExp(`^NOVO([${INVITE_ALPHABET}]{${INVITE_BODY_LENGTH}})$`);

/** Novi pozivni kod oblika NOVO-XXXX-XXXX (~39 bita entropije iz crypto.randomBytes, bez modulo pristranosti). */
export function generateInviteCode(): string {
  const limit = 256 - (256 % INVITE_ALPHABET.length);
  let body = "";
  while (body.length < INVITE_BODY_LENGTH) {
    for (const b of randomBytes(16)) {
      if (b >= limit) continue; // odbaci bajtove koji bi pristrano favorizirali prve znakove
      body += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
      if (body.length === INVITE_BODY_LENGTH) break;
    }
  }
  return `NOVO-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Kanonski oblik koda koji je korisnik upisao (velika/mala slova, razmaci i crtice su svejedno),
 * ili null ako uopće nije oblika NOVO-XXXX-XXXX pa ga nema smisla tražiti u bazi.
 */
export function normalizeInviteCode(input: string): string | null {
  const m = INVITE_SHAPE.exec(input.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  return m ? `NOVO-${m[1].slice(0, 4)}-${m[1].slice(4)}` : null;
}

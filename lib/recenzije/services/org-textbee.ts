import "server-only";
import { randomBytes } from "crypto";
import { eq, sql } from "drizzle-orm";
import { decrypt, encrypt } from "@/lib/recenzije/crypto";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { organizations } from "@/lib/recenzije/db/schema";
import { AdminError } from "./novo-admin";
import { hasOwnTextbee } from "./sms";
import { textbeeHookSeenKey } from "./textbee-hook-seen";
import { listTextbeeDevices, type TextbeeCreds } from "./textbee";
import { TEXTBEE_DEVICE_ID_PATTERN } from "@/lib/recenzije/textbee";

/**
 * TextBee mobitel jedne tvrtke (nr_organizations.textbee_*). Sve je samo za glavnog admina (provjerava pozivatelj). Ključ i tajna
 * webhooka su u bazi šifrirani; ništa odavde ne vraća ključ, a tajna webhooka se vraća samo kad je admin izričito traži.
 */

const META_SEEN = textbeeHookSeenKey;

/** Nova tajna webhooka: 48 heksadecimalnih znakova (192 bita), dovoljno dugo za sva ograničenja TextBeea (barem 20 znakova). */
export const newWebhookSecret = () => randomBytes(24).toString("hex");

async function loadOrg(organizationId: string) {
  await ensureReviewsDb();
  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      isDemo: organizations.isDemo,
      keyEnc: organizations.textbeeApiKeyEnc,
      deviceId: organizations.textbeeDeviceId,
      secretEnc: organizations.textbeeWebhookSecretEnc,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) throw new AdminError("Klijent nije pronađen.");
  return org;
}

async function loadEditable(organizationId: string) {
  const org = await loadOrg(organizationId);
  if (org.isDemo) throw new AdminError("Demo je samo za razgledavanje: njemu se mobitel ne postavlja.");
  return org;
}

/**
 * Za webhook: tvrtka i njezina dešifrirana tajna (uz API ključ, ali samo da ga se može izbaciti iz teksta grešaka); null kad tvrtke nema,
 * nema mobitela ili tajne (pozivatelj to ne razlikuje od lošeg potpisa).
 */
export async function resolveOrgWebhook(organizationId: string): Promise<{ id: string; secret: string; apiKey: string | null } | null> {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(organizationId)) return null;
  await ensureReviewsDb();
  const [org] = await db
    .select({ id: organizations.id, keyEnc: organizations.textbeeApiKeyEnc, deviceId: organizations.textbeeDeviceId, secretEnc: organizations.textbeeWebhookSecretEnc })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org?.secretEnc || !hasOwnTextbee({ textbeeApiKeyEnc: org.keyEnc, textbeeDeviceId: org.deviceId })) return null;
  try {
    let apiKey: string | null = null;
    try {
      apiKey = org.keyEnc ? decrypt(org.keyEnc) : null;
    } catch {
      /* ključ koji se ne da pročitati ne smije spriječiti webhook; samo se ne može izbaciti iz teksta */
    }
    return { id: org.id, secret: decrypt(org.secretEnc), apiKey };
  } catch {
    return null;
  }
}

/**
 * Sprema ključ i ID uređaja. Prazan `apiKey` zadržava spremljeni ključ (ključ se nikad ne prikazuje, pa ga se ne može ni prepisati u
 * formu). Pri prvom spremanju nastaje i tajna webhooka; tada je `secretCreated` true.
 */
export async function saveOrgTextbee(organizationId: string, input: { apiKey: string | null; deviceId: string }) {
  const org = await loadEditable(organizationId);
  if (!input.apiKey && !org.keyEnc) throw new AdminError("Upišite API ključ iz TextBee nadzorne ploče.");
  const secretCreated = !org.secretEnc;
  await db
    .update(organizations)
    .set({
      ...(input.apiKey ? { textbeeApiKeyEnc: encrypt(input.apiKey) } : {}),
      textbeeDeviceId: input.deviceId,
      ...(secretCreated ? { textbeeWebhookSecretEnc: encrypt(newWebhookSecret()) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));
  return { name: org.name, secretCreated };
}

/** Nova tajna webhooka (stara prestaje vrijediti čim se spremi; u TextBee nadzornoj ploči treba upisati novu). */
export async function regenerateOrgWebhookSecret(organizationId: string) {
  const org = await loadEditable(organizationId);
  if (!hasOwnTextbee({ textbeeApiKeyEnc: org.keyEnc, textbeeDeviceId: org.deviceId })) {
    throw new AdminError("Prvo spremite API ključ i ID uređaja.");
  }
  const secret = newWebhookSecret();
  await db.update(organizations).set({ textbeeWebhookSecretEnc: encrypt(secret), updatedAt: new Date() }).where(eq(organizations.id, organizationId));
  await db.execute(sql`delete from nr_meta where key = ${META_SEEN(organizationId)}`);
  return { name: org.name, secret };
}

/** Tajna webhooka za prikaz adminu (kopiranje u TextBee). */
export async function revealOrgWebhookSecret(organizationId: string) {
  const org = await loadOrg(organizationId);
  if (!org.secretEnc) throw new AdminError("Tajna webhooka još ne postoji: prvo spremite mobitel.");
  try {
    return decrypt(org.secretEnc);
  } catch {
    throw new AdminError("Tajna se ne može pročitati. Napravite novu.");
  }
}

/** Uklanja mobitel tvrtke: poruke tvrtke odmah idu sljedećim pružateljem (zajednički NOVO mobitel, TextBee ili Twilio). */
export async function clearOrgTextbee(organizationId: string) {
  const org = await loadOrg(organizationId);
  await db
    .update(organizations)
    .set({ textbeeApiKeyEnc: null, textbeeDeviceId: null, textbeeWebhookSecretEnc: null, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));
  await db.execute(sql`delete from nr_meta where key = ${META_SEEN(organizationId)}`);
  return org.name;
}

export type TextbeeCheck = {
  /** Uređaj s tim ID-om postoji na računu. */
  found: boolean;
  device: { id: string; name: string; enabled: boolean | null; online: boolean | null; lastHeartbeat: string | null } | null;
  others: { id: string; name: string }[];
  total: number;
};

/**
 * Provjera veze (samo čitanje, bez ikakve poruke): popis uređaja računa tvrtke i je li među njima upisani ID. Koristi upisani ključ
 * ako je u formi, inače spremljeni.
 */
export async function checkOrgTextbee(organizationId: string, input: { apiKey: string | null; deviceId: string | null }): Promise<TextbeeCheck> {
  const org = await loadOrg(organizationId);
  let apiKey = input.apiKey;
  if (!apiKey && org.keyEnc) {
    try {
      apiKey = decrypt(org.keyEnc);
    } catch {
      throw new AdminError("Spremljeni ključ se ne može pročitati. Upišite ga ponovno.");
    }
  }
  if (!apiKey) throw new AdminError("Upišite API ključ iz TextBee nadzorne ploče.");
  const deviceId = (input.deviceId || org.deviceId || "").trim();
  if (!deviceId) throw new AdminError("Upišite ID uređaja.");
  const creds: TextbeeCreds = { apiKey, deviceId };
  const devices = await listTextbeeDevices(creds);
  const device = devices.find((d) => d.id === deviceId) ?? null;
  return {
    found: !!device,
    device: device ? { id: device.id, name: device.name, enabled: device.enabled, online: device.online, lastHeartbeat: device.lastHeartbeat } : null,
    others: devices.filter((d) => d.id !== deviceId).map((d) => ({ id: d.id, name: d.name })),
    total: devices.length,
  };
}

export const isValidDeviceId = (v: string) => TEXTBEE_DEVICE_ID_PATTERN.test(v);

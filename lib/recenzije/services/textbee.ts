import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { env, integrations } from "@/lib/recenzije/env";
import { toE164 } from "@/lib/recenzije/phone";
import {
  TEXTBEE_KEY_HEADER,
  TEXTBEE_NETWORK_ERROR,
  TEXTBEE_PATHS,
  TEXTBEE_TIMEOUT_ERROR,
  TEXTBEE_TIMEOUT_MS,
  cleanServerMessage,
  describeTextbeeError,
  errorMessageFromBody,
  parseTextbeeDevices,
  parseTextbeeSendResponse,
  signedPayloadVariants,
  textbeeSenderMarker,
  type TextbeeDevice,
} from "@/lib/recenzije/textbee";

/**
 * TextBee (textbee.dev) kao SMS pružatelj: poruke odlaze s vlastitog mobitela i vlastite SIM kartice (aplikacija na mobitelu
 * + oblak s REST API-jem). Sve pretpostavke o tuđem API-ju su u lib/recenzije/textbee.ts.
 *
 * API ključ dolazi ISKLJUČIVO iz env varijable TEXTBEE_API_KEY. Ovdje se nikad ne ispisuje, ne logira i ne ulazi u poruke grešaka
 * (sve što dolazi od TextBeea prolazi kroz scrubSecrets). Modul namjerno ne uvozi ./sms (izbjegava kružni uvoz): sms.ts zove ovaj modul.
 */

/** Greška TextBee API-ja; `message` je već čitljiva hrvatska poruka bez ključa. */
export class TextbeeApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null
  ) {
    super(message);
    this.name = "TextbeeApiError";
  }
}

export const TEXTBEE_NOT_CONFIGURED =
  "TextBee nije postavljen: u postavkama servera treba postaviti TEXTBEE_API_KEY i TEXTBEE_DEVICE_ID.";

export type TextbeeSendResult = { sid: string; status: string; from: string };

const secretsToScrub = () => [env.textbeeApiKey, env.textbeeWebhookSecret];

async function textbeeFetch(path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<Response> {
  try {
    return await fetch(`${env.textbeeApiBase}${path}`, {
      method: init.method,
      headers: {
        [TEXTBEE_KEY_HEADER]: env.textbeeApiKey,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TEXTBEE_TIMEOUT_MS),
      // Nikad ne slijedi preusmjeravanja: fetch pri prelasku na drugi izvor skida samo Authorization, a x-api-key bi ostao
      // u zahtjevu i ključ bi otišao na tuđu adresu. 3xx se tretira kao neočekivan odgovor (httpError).
      redirect: "manual",
    });
  } catch (e) {
    // Namjerno se ne koristi e.message: ne treba ništa osim vrste greške.
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new TextbeeApiError(timeout ? TEXTBEE_TIMEOUT_ERROR : TEXTBEE_NETWORK_ERROR, null);
  }
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

function httpError(res: Response, json: unknown) {
  const message = cleanServerMessage(errorMessageFromBody(json), secretsToScrub());
  return new TextbeeApiError(describeTextbeeError(res.status, message), res.status);
}

/**
 * Šalje jedan SMS preko TextBeea s uređaja TEXTBEE_DEVICE_ID. Jedan poziv = jedan primatelj = jedna poruka (TextBee grupna
 * slanja imaju isti tekst za sve, a naše poruke su personalizirane). Uspjeh (HTTP 2xx) znači "TextBee je prihvatio poruku",
 * ne "isporučeno": isporuka stiže webhookom (TEXTBEE_WEBHOOK_SECRET). `sid` je ID za uparivanje tih potvrda.
 */
export async function sendViaTextbee(params: { to: string; body: string }): Promise<TextbeeSendResult> {
  if (!integrations.textbee()) throw new TextbeeApiError(TEXTBEE_NOT_CONFIGURED, null);
  const to = toE164(params.to);
  if (!to) throw new TextbeeApiError("TextBee: broj primatelja nije ispravan. Upišite ga u obliku +385 91 234 5678.", null);

  const recipients = [to];
  let res = await textbeeFetch(TEXTBEE_PATHS.sendSms, {
    method: "POST",
    body: { deviceId: env.textbeeDeviceId, recipients, message: params.body },
  });
  if (res.status === 404) {
    // Trenutni put ne postoji (starija ili samostalno postavljena inačica TextBeea): pri 404 poruka nije poslana, pa je
    // sigurno probati zastarjeli put s ID-om uređaja u adresi. Za nepoznat uređaj i on vrati 404, pa se vidi ista greška.
    await res.body?.cancel().catch(() => undefined);
    res = await textbeeFetch(TEXTBEE_PATHS.sendSmsLegacy(env.textbeeDeviceId), {
      method: "POST",
      body: { recipients, message: params.body },
    });
  }
  const json = await readJson(res);
  if (!res.ok) throw httpError(res, json);

  const parsed = parseTextbeeSendResponse(json);
  if (parsed.rejected) {
    const reason = cleanServerMessage(errorMessageFromBody(json), secretsToScrub());
    throw new TextbeeApiError(`TextBee nije prihvatio poruku${reason ? `: ${reason}` : "."}`, res.status);
  }
  return {
    // Bez ID-a u odgovoru poruka je svejedno poslana; lokalni ID samo drži jedinstvenost provider_sid, isporuka se tada ne prati.
    sid: parsed.id ?? `tb-${randomUUID()}`,
    status: parsed.status ?? "queued",
    from: textbeeSenderMarker(env.textbeeDeviceId),
  };
}

/** Uređaji računa (GET /gateway/devices), samo čitanje. Ključ se ne vraća. */
export async function listTextbeeDevices(): Promise<TextbeeDevice[]> {
  if (!env.textbeeApiKey) throw new TextbeeApiError("TextBee nije postavljen: u postavkama servera treba postaviti TEXTBEE_API_KEY.", null);
  const res = await textbeeFetch(TEXTBEE_PATHS.devices, { method: "GET" });
  const json = await readJson(res);
  if (!res.ok) throw httpError(res, json);
  return parseTextbeeDevices(json);
}

/**
 * X-Signature webhooka: hex HMAC-SHA256 tijela zahtjeva s tajnom (TEXTBEE_WEBHOOK_SECRET), usporedba u konstantnom vremenu.
 * Provjerava se sirovo tijelo, a ako se razlikuje i kompaktni JSON istog sadržaja (dokumentacija se razilazi, vidi
 * signedPayloadVariants). Bez tajne ili bez potpisa uvijek false, pa se nepotpisan zahtjev nikad ne obrađuje.
 */
export function verifyTextbeeSignature(secret: string, rawBody: string, signatureHeader: string | null | undefined): boolean {
  if (!secret || !signatureHeader) return false;
  const value = signatureHeader.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/.test(value)) return false;
  const given = Buffer.from(value, "hex");
  let ok = false;
  for (const payload of signedPayloadVariants(rawBody)) {
    const expected = createHmac("sha256", secret).update(payload).digest();
    // Sve inačice se uvijek izračunaju i usporede (bez ranog izlaza), pa trajanje ne otkriva koja je pogodila.
    if (timingSafeEqual(expected, given)) ok = true;
  }
  return ok;
}

import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { messages } from "@/lib/recenzije/db/schema";
import { env } from "@/lib/recenzije/env";
import { applyDeliveryStatus, gatewayPhoneCandidates, handleSharedPhoneInbound } from "@/lib/recenzije/services/inbound";
import { verifyTextbeeSignature } from "@/lib/recenzije/services/textbee";
import { TEXTBEE_SIGNATURE_HEADER, cleanServerMessage, parseTextbeeWebhook, type TextbeeWebhookEvent } from "@/lib/recenzije/textbee";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Webhook TextBeea (textbee.dev) za vlastiti mobitel s vlastitim brojem. Adresa se upisuje u TextBee nadzornoj ploči
 * (Webhooks), a tajna koju ondje upišete mora biti ISTA kao TEXTBEE_WEBHOOK_SECRET.
 *
 * Potpis: X-Signature = hex(HMAC-SHA256(TEXTBEE_WEBHOOK_SECRET, tijelo)), usporedba u konstantnom vremenu
 * (verifyTextbeeSignature; točan oblik potpisanog teksta vidi lib/recenzije/textbee.ts). Bez tajne 503, bez ispravnog
 * potpisa 403, a nepotpisan zahtjev se NIKAD ne obrađuje ni ne dira bazu.
 *
 * Događaji: MESSAGE_RECEIVED (odgovor; STOP odjavljuje broj u svim tvrtkama, odgovor se pripisuje tvrtki koja je tom broju
 * zadnja poslala preko TextBeea) te MESSAGE_SENT / DELIVERED / FAILED (status isporuke). TextBee ponavlja isporuku dok ne dobije 2xx
 * i ne jamči redoslijed, a obrada je idempotentna i ne vraća konačno stanje unatrag.
 */

/** ID dolazne poruke za otkrivanje ponovljenih isporuka; bez ikakvog identifikatora poruka se ne dedupira. */
function inboundId(evt: TextbeeWebhookEvent, from: string) {
  const id = evt.smsId || evt.idempotencyKey;
  if (id) return `in:tb:${id}`;
  if (evt.receivedAt) return `in:tb:h${createHash("sha256").update(`${from}|${evt.receivedAt}|${evt.message ?? ""}`).digest("hex").slice(0, 24)}`;
  return null;
}

/**
 * Status isporuke za poruku koju smo poslali. Odgovor na slanje daje smsBatchId (ili ID poruke), a webhook nosi oba, pa se
 * redom traži prvi ID koji pripada našoj poruci. Ponovljena isporuka istog statusa ne radi ništa (nema duplih aktivnosti),
 * a applyDeliveryStatus ne vraća konačno stanje unatrag (npr. SENT poslije DELIVERED, jer redoslijed događaja nije zajamčen).
 */
async function applyStatus(evt: TextbeeWebhookEvent, status: "SENT" | "DELIVERED" | "FAILED", error?: string) {
  const ids = [...new Set([evt.smsBatchId, evt.smsId].filter((x): x is string => !!x))];
  for (const id of ids) {
    const [existing] = await db.select({ status: messages.status }).from(messages).where(eq(messages.providerSid, id)).limit(1);
    if (!existing) continue;
    if (existing.status !== status) await applyDeliveryStatus(id, status, error);
    return;
  }
}

export async function POST(req: Request) {
  const secret = env.textbeeWebhookSecret;
  if (!secret) return new Response("Not configured", { status: 503 });

  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  if (!verifyTextbeeSignature(secret, raw, req.headers.get(TEXTBEE_SIGNATURE_HEADER))) {
    return new Response("Invalid signature", { status: 403 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const evt = parseTextbeeWebhook(json);
  if (!evt) return new Response("Bad payload", { status: 400 });

  try {
    await ensureReviewsDb();
    switch (evt.kind) {
      case "received": {
        const from = gatewayPhoneCandidates(evt.sender || "");
        if (from.length > 0) {
          await handleSharedPhoneInbound({
            from,
            body: evt.message || "",
            providerSid: inboundId(evt, from[0]),
            channel: "textbee",
          });
        }
        break;
      }
      case "sent":
        await applyStatus(evt, "SENT");
        break;
      case "delivered":
        await applyStatus(evt, "DELIVERED");
        break;
      case "failed": {
        const reason = cleanServerMessage(evt.errorMessage || (evt.errorCode ? `kod ${evt.errorCode}` : ""), [secret]) || "slanje nije uspjelo";
        await applyStatus(evt, "FAILED", `TextBee: ${reason}`.slice(0, 200));
        break;
      }
      default:
        // UNKNOWN_STATE i nepoznati događaji: potvrđujemo prijem da ih TextBee ne ponavlja.
        break;
    }
  } catch (e) {
    // Bez detalja prema van; 500 tjera TextBee da ponovi isporuku (obrada je idempotentna).
    console.error("[recenzije] TextBee webhook", evt.event, e instanceof Error ? e.name : typeof e);
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}

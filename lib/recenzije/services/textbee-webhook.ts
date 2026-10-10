import "server-only";
import { createHash } from "crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { messages } from "@/lib/recenzije/db/schema";
import { applyDeliveryStatus, gatewayPhoneCandidates, handleSharedPhoneInbound } from "./inbound";
import { verifyTextbeeSignature } from "./textbee";
import { textbeeHookSeenKey } from "./textbee-hook-seen";
import { TEXTBEE_SIGNATURE_HEADER, cleanServerMessage, parseTextbeeWebhook, type TextbeeWebhookEvent } from "@/lib/recenzije/textbee";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * Obrada TextBee webhooka, zajednička za dvije rute:
 *  - app/api/recenzije/webhooks/textbee (zajednički mobitel, tajna TEXTBEE_WEBHOOK_SECRET),
 *  - app/api/recenzije/webhooks/textbee/[orgId] (mobitel jedne tvrtke, tajna te tvrtke iz baze).
 * Potpis: X-Signature = hex(HMAC-SHA256(tajna, tijelo)), usporedba u konstantnom vremenu (verifyTextbeeSignature). Nepotpisan zahtjev se
 * NIKAD ne obrađuje ni ne dira bazu. Događaji: MESSAGE_RECEIVED (odgovor; STOP odjavljuje broj u svim tvrtkama), MESSAGE_SENT /
 * DELIVERED / FAILED (status isporuke). TextBee ponavlja isporuku dok ne dobije 2xx i ne jamči redoslijed, a obrada je idempotentna.
 */

export type TextbeeHookTarget =
  /** Zajednički mobitel: tajna iz env varijable (prazno = nije postavljeno, 503 kao i prije). */
  | { kind: "shared"; secret: string }
  /** Mobitel tvrtke: tajna i tvrtka. `null` = nepoznata tvrtka ili tvrtka bez tajne (odgovor je isti kao za loš potpis). */
  | { kind: "org"; org: { id: string; secret: string; apiKey?: string | null } | null };

/** Tajna za usporedbu kad nema prave (nepoznata tvrtka): da trajanje i odgovor ne otkriju razliku. */
const DUMMY_SECRET = "0".repeat(48);

/** ID dolazne poruke za otkrivanje ponovljenih isporuka; bez ikakvog identifikatora poruka se ne dedupira. */
function inboundId(evt: TextbeeWebhookEvent, from: string) {
  const id = evt.smsId || evt.idempotencyKey;
  if (id) return `in:tb:${id}`;
  if (evt.receivedAt) return `in:tb:h${createHash("sha256").update(`${from}|${evt.receivedAt}|${evt.message ?? ""}`).digest("hex").slice(0, 24)}`;
  return null;
}

/**
 * Status isporuke za poruku koju smo poslali. Odgovor na slanje daje smsBatchId (ili ID poruke), a webhook nosi oba, pa se
 * redom traži prvi ID koji pripada našoj poruci (kod mobitela tvrtke samo među porukama te tvrtke). Ponovljena isporuka istog
 * statusa ne radi ništa (nema duplih aktivnosti), a applyDeliveryStatus ne vraća konačno stanje unatrag.
 */
async function applyStatus(evt: TextbeeWebhookEvent, status: "SENT" | "DELIVERED" | "FAILED", error: string | undefined, organizationId?: string) {
  const ids = [...new Set([evt.smsBatchId, evt.smsId].filter((x): x is string => !!x))];
  for (const id of ids) {
    const [existing] = await db
      .select({ status: messages.status, organizationId: messages.organizationId })
      .from(messages)
      .where(eq(messages.providerSid, id))
      .limit(1);
    if (!existing || (organizationId && existing.organizationId !== organizationId)) continue;
    if (existing.status !== status) await applyDeliveryStatus(id, status, error, organizationId);
    return;
  }
}

/** Zabilježi da je potpisan webhook stvarno stigao (samo za prikaz u adminu: "webhook radi"). Greška ovdje ne smije srušiti obradu. */
async function markHookSeen(organizationId: string) {
  try {
    await db.execute(
      sql`insert into nr_meta (key, value) values (${textbeeHookSeenKey(organizationId)}, ${new Date().toISOString()})
          on conflict (key) do update set value = excluded.value`
    );
  } catch {
    /* samo informacija za admina */
  }
}

export async function handleTextbeeWebhook(req: Request, target: TextbeeHookTarget): Promise<Response> {
  if (target.kind === "shared" && !target.secret) return new Response("Not configured", { status: 503 });
  const secret = target.kind === "shared" ? target.secret : (target.org?.secret ?? DUMMY_SECRET);
  const org = target.kind === "org" ? target.org : null;

  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return new Response("Payload too large", { status: 413 });
  // Potpis se provjerava uvijek, i kad tvrtka ne postoji (tada protiv lažne tajne, pa je odgovor 403 kao i za loš potpis).
  const valid = verifyTextbeeSignature(secret, raw, req.headers.get(TEXTBEE_SIGNATURE_HEADER));
  if (!valid || (target.kind === "org" && !org)) return new Response("Invalid signature", { status: 403 });

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
    if (org) await markHookSeen(org.id);
    switch (evt.kind) {
      case "received": {
        const from = gatewayPhoneCandidates(evt.sender || "");
        if (from.length > 0) {
          await handleSharedPhoneInbound({
            from,
            body: evt.message || "",
            providerSid: inboundId(evt, from[0]),
            channel: "textbee",
            scope: org ? { organizationId: org.id } : { excludeOwnPhoneOrgs: true },
          });
        }
        break;
      }
      case "sent":
        await applyStatus(evt, "SENT", undefined, org?.id);
        break;
      case "delivered":
        await applyStatus(evt, "DELIVERED", undefined, org?.id);
        break;
      case "failed": {
        const reason = cleanServerMessage(evt.errorMessage || (evt.errorCode ? `kod ${evt.errorCode}` : ""), [secret, org?.apiKey]) || "slanje nije uspjelo";
        await applyStatus(evt, "FAILED", `TextBee: ${reason}`.slice(0, 200), org?.id);
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

import { eq } from "drizzle-orm";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { organizations } from "@/lib/recenzije/db/schema";
import { decrypt } from "@/lib/recenzije/crypto";
import { toE164 } from "@/lib/recenzije/phone";
import { applyDeliveryStatus, handleInboundSms } from "@/lib/recenzije/services/inbound";
import { verifyGatewaySignature } from "@/lib/recenzije/services/sms";

type Event = {
  event?: string;
  payload?: { messageId?: string; message?: string; sender?: string; recipient?: string; phoneNumber?: string; reason?: string };
};

/**
 * Webhookovi aplikacije SMS Gateway for Android (mobitel tvrtke).
 * Potpis: X-Signature = hex(HMAC-SHA256(signing key, tijelo + X-Timestamp)).
 */
export async function POST(req: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  if (!/^[a-z0-9]{10,40}$/.test(orgId)) return new Response("Not found", { status: 404 });
  const raw = await req.text();
  await ensureReviewsDb();
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org?.smsGatewaySigningKeyEnc) return new Response("Not configured", { status: 404 });
  const ok = verifyGatewaySignature(decrypt(org.smsGatewaySigningKeyEnc), raw, req.headers.get("x-signature"), req.headers.get("x-timestamp"));
  if (!ok) return new Response("Invalid signature", { status: 403 });

  let evt: Event;
  try {
    evt = (JSON.parse(raw) as Event | null) ?? {};
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const p = evt.payload ?? {};
  switch (evt.event) {
    case "sms:received": {
      const from = toE164(p.sender || p.phoneNumber || "", "385");
      if (from) await handleInboundSms({ organizationId: org.id, from, to: p.recipient || "", body: p.message || "", providerSid: p.messageId ? `in:${p.messageId}` : null });
      break;
    }
    case "sms:sent":
      if (p.messageId) await applyDeliveryStatus(p.messageId, "SENT", undefined, org.id);
      break;
    case "sms:delivered":
      if (p.messageId) await applyDeliveryStatus(p.messageId, "DELIVERED", undefined, org.id);
      break;
    case "sms:failed":
      if (p.messageId) await applyDeliveryStatus(p.messageId, "FAILED", `Mobitel: ${p.reason || "slanje nije uspjelo"}`, org.id);
      break;
  }
  return Response.json({ ok: true });
}

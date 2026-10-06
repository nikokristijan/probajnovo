import "server-only";
import { env } from "@/lib/recenzije/env";
import { verifyTwilioSignature } from "@/lib/recenzije/services/sms";

/** Parses a Twilio form POST and verifies its signature against our public URL. */
export async function readTwilio(req: Request, path: string) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  const ok = verifyTwilioSignature(`${env.appUrl}${path}`, params, req.headers.get("x-twilio-signature"));
  return { ok, params };
}

export const twiml = (body = "") =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } });

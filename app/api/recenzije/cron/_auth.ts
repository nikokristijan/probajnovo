import "server-only";
import { timingSafeEqual } from "crypto";
import { env } from "@/lib/recenzije/env";

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Without a secret, nothing runs. */
export function cronAuthorized(req: Request) {
  if (!env.cronSecret) return false;
  const got = Buffer.from(req.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${env.cronSecret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

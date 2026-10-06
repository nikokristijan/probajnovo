import { NextResponse } from "next/server";
import { randomToken } from "@/lib/recenzije/crypto";
import { env, integrations } from "@/lib/recenzije/env";
import { googleLoginUrl } from "@/lib/recenzije/services/google";

/** Početak prijave Google računom. State se čuva u kratkotrajnom httpOnly kolačiću. */
export async function GET() {
  if (!integrations.googleOAuth()) return NextResponse.redirect(`${env.appUrl}/recenzije/prijava?error=google_off`);
  const state = randomToken(16);
  const res = NextResponse.redirect(googleLoginUrl(state));
  res.cookies.set("nr_oauth", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}

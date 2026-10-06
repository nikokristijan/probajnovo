import { NextResponse } from "next/server";
import { env, integrations } from "@/lib/recenzije/env";
import { getOrgForApi } from "@/lib/recenzije/session";
import { createOAuthState, googleAuthUrl } from "@/lib/recenzije/services/google";

/** Starts the real Google OAuth flow for Business Profile access. */
export async function GET() {
  const ctx = await getOrgForApi();
  if (!ctx) return NextResponse.redirect(`${env.appUrl}/recenzije/prijava`);
  if (!["OWNER", "ADMIN"].includes(ctx.role)) return NextResponse.redirect(`${env.appUrl}/recenzije/postavke?google=forbidden`);
  if (!integrations.googleOAuth()) return NextResponse.redirect(`${env.appUrl}/recenzije/postavke?google=not_configured`);
  if (ctx.org.isDemo) return NextResponse.redirect(`${env.appUrl}/recenzije/postavke?google=demo`);
  return NextResponse.redirect(googleAuthUrl(createOAuthState(ctx.org.id, ctx.user.id)));
}

import { eq, or } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { createSession } from "@/lib/recenzije/auth";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { users } from "@/lib/recenzije/db/schema";
import { env } from "@/lib/recenzije/env";
import { googleLoginProfile } from "@/lib/recenzije/services/google";

export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${env.appUrl}/recenzije/prijava?error=${q}`);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = req.cookies.get("nr_oauth")?.value;
  if (!code || !state || !expected || state !== expected) return back("google");
  try {
    await ensureReviewsDb();
    const p = await googleLoginProfile(code);
    let [user] = await db.select().from(users).where(or(eq(users.googleId, p.googleId), eq(users.email, p.email))).limit(1);
    if (!user) {
      [user] = await db.insert(users).values({ email: p.email, name: p.name, image: p.image, googleId: p.googleId, emailVerified: new Date() }).returning();
    } else if (!user.googleId) {
      // Google je potvrdio vlasništvo nad emailom, pa je sigurno povezati postojeći račun.
      await db.update(users).set({ googleId: p.googleId, emailVerified: user.emailVerified ?? new Date() }).where(eq(users.id, user.id));
    }
    await createSession(user.id);
    const res = NextResponse.redirect(`${env.appUrl}/recenzije/pregled`);
    res.cookies.delete("nr_oauth");
    return res;
  } catch (e) {
    console.error("[recenzije] google login", e);
    return back("google");
  }
}

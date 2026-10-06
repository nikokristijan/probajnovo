import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/recenzije/env";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { assertMember, getCurrentUser } from "@/lib/recenzije/session";
import { completeGoogleConnection, verifyOAuthState } from "@/lib/recenzije/services/google";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const back = (q: string) => NextResponse.redirect(`${env.appUrl}/recenzije/postavke?google=${q}`);
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  const state = verifyOAuthState(url.searchParams.get("state") || "");
  if (!code || !state) return back("invalid_state");
  // The state is signed, but also require the same logged-in user who started the flow.
  const user = await getCurrentUser();
  if (!user || user.id !== state.userId || !(await assertMember(user.id, state.organizationId))) return back("invalid_state");
  try {
    await ensureReviewsDb();
    await completeGoogleConnection(state.organizationId, code);
    return back("connected");
  } catch (e) {
    console.error("[google] callback failed", e);
    return back("error");
  }
}

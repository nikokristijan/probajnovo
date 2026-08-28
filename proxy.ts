import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "novo_admin_session";

// Ova ruta unutar /admin ne smije tražiti prijavu (inače nitko ne bi mogao
// doći do login forme).
const PUBLIC_ADMIN_PATHS = new Set(["/admin/login"]);

async function hasValidSession(req: NextRequest): Promise<boolean> {
const token = req.cookies.get(COOKIE_NAME)?.value;
if (!token) return false;
const secret = process.env.SESSION_SECRET;
if (!secret) return false;
try {
await jwtVerify(token, new TextEncoder().encode(secret));
return true;
} catch {
return false;
}
}

// Optimistic check (čita samo kolačić) — svaka server akcija radi i svoju
// pravu provjeru sesije prije bilo kakve izmjene baze. Vidi lib/auth.ts.
export async function proxy(req: NextRequest) {
const { pathname } = req.nextUrl;
if (!pathname.startsWith("/admin") || PUBLIC_ADMIN_PATHS.has(pathname)) {
return NextResponse.next();
}

const authed = await hasValidSession(req);
if (authed) return NextResponse.next();

const loginUrl = new URL("/admin/login", req.url);
loginUrl.searchParams.set("next", pathname);
return NextResponse.redirect(loginUrl);
}

export const config = {
matcher: ["/admin/:path*"],
};

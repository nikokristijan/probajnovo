import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { guestCookieName, verifyGuestCookie } from "@/lib/recenzije/guest-cookie";
import { safeExternalUrl } from "@/components/jelovnik/lang";
import { MenuKindProvider } from "@/components/jelovnik/kind-context";
import { loadMenuContent, loadMenuInfo } from "./data";

/**
 * 1) Nepoznata ili ugašena adresa se odbija ovdje, PRIJE nego što loading.tsx pošalje kostur, da odgovor ima pravi status
 *    404 (inače bi streaming već poslao 200).
 * 2) Podaci koje će stranica trebati učitaju se ovdje (upiti su u cacheu pa ih stranica samo pročita). Tako se u HTML-u
 *    nikad ne nađe kostur umjesto sadržaja i stranica radi i bez JavaScripta. Sadržaj jelovnika učitava se samo kad ga
 *    gost može vidjeti: ima važeći kolačić ili lokal dopušta pregled bez broja.
 */
export default async function MenuSlugLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const info = await loadMenuInfo(slug);
  if (!info) notFound();
  const jar = await cookies();
  const maySeeMenu = info.allowSkip || verifyGuestCookie(info.id, jar.get(guestCookieName(info.id))?.value);
  if (maySeeMenu && !safeExternalUrl(info.externalUrl)) await loadMenuContent(slug);
  return <MenuKindProvider kind={info.menuKind}>{children}</MenuKindProvider>;
}

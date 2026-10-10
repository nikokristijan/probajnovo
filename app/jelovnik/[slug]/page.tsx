import type { Metadata } from "next";
import type { GateResult } from "./actions";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { LANG_COOKIE, MASKED_PHONE_PATTERN, GATE_MESSAGES } from "@/components/jelovnik/constants";
import { GateView } from "@/components/jelovnik/gate-view";
import { resolveLang, safeExternalUrl } from "@/components/jelovnik/lang";
import { ExternalMenuView, MenuView } from "@/components/jelovnik/menu-view";
import { cleanTable } from "@/components/jelovnik/table";
import { guestCookieName } from "@/lib/recenzije/guest-cookie";
import { kickDueRuns } from "@/lib/recenzije/services/automation-kick";
import { decideAccess, loadMenuContent, loadMenuInfo } from "./data";

// Stranica ovisi o kolačiću gosta i bazi: nikad se ne sprema u predmemoriju.
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Greška s vrata kad je obrazac poslan bez JavaScripta: akcija vraća na stranicu s ?greska=<šifra>. */
function noticeFromQuery(code: string | undefined): GateResult | null {
  switch (code) {
    case "telefon":
      return { error: GATE_MESSAGES.phone, field: "phone" };
    case "privola":
      return { error: GATE_MESSAGES.consent, field: "consent" };
    case "previse":
      return { error: GATE_MESSAGES.busy, field: null };
    case "greska":
      return { error: GATE_MESSAGES.generic, field: null };
    default:
      return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const info = await loadMenuInfo(slug);
  // Ne indeksirati nikad (ni 404, ni jelovnik): vidi i layout.tsx.
  const robots = { index: false, follow: false, nocache: true } as const;
  if (!info) return { title: { absolute: "Jelovnik nije dostupan" }, robots };
  return { title: { absolute: `${info.venueName} · ${info.title}` }, robots };
}

export default async function MenuPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;

  const info = await loadMenuInfo(slug);
  if (!info) notFound();

  const jar = await cookies();
  const access = decideAccess(info, jar.get(guestCookieName(info.id))?.value, first(sp.pregled) === "1");

  // Zakazane poruke gostima napreduju i bez vanjskog crona (vidi automation-kick.ts).
  kickDueRuns(25);

  if (access === "gate") {
    const table = cleanTable(first(sp.stol));
    const skipHref = info.allowSkip ? `/jelovnik/${info.slug}?pregled=1${table ? `&stol=${encodeURIComponent(table)}` : ""}` : null;
    return <GateView menu={info} table={table} skipHref={skipHref} initialNotice={noticeFromQuery(first(sp.greska))} />;
  }

  // Kratka potvrda nakon unosa broja (postavlja je akcija; maskirani broj ili "-" kad nema što pokazati).
  const flashRaw = jar.get(`${guestCookieName(info.id)}_ok`)?.value;
  const flash =
    flashRaw === undefined
      ? null
      : MASKED_PHONE_PATTERN.test(flashRaw)
        ? `Hvala. Broj ${flashRaw} je zaprimljen.`
        : flashRaw === "-"
          ? "Hvala. Jelovnik je otvoren."
          : null;

  const external = safeExternalUrl(info.externalUrl);
  if (external) return <ExternalMenuView menu={info} href={external} flash={flash} />;

  const menu = await loadMenuContent(slug);
  if (!menu) notFound();
  const h = await headers();
  const lang = resolveLang({
    hasEnglish: menu.hasEnglish,
    cookie: jar.get(LANG_COOKIE)?.value,
    acceptLanguage: h.get("accept-language"),
  });
  return <MenuView menu={menu} lang={lang} flash={flash} />;
}

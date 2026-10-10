"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FLASH_MAX_AGE_SECONDS, GATE_LIMITS, GATE_MESSAGES } from "@/components/jelovnik/constants";
import { cleanTable } from "@/components/jelovnik/table";
import { guestCookieName, guestCookieOptions, signGuestCookie } from "@/lib/recenzije/guest-cookie";
import { maskPhone } from "@/lib/recenzije/menu-format";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { clientIp } from "@/lib/recenzije/request";
import { kickDueRuns } from "@/lib/recenzije/services/automation-kick";
import { captureGuest, normalizeGuestPhone } from "@/lib/recenzije/services/guests";
import { getPublicMenuInfoBySlug, normalizePublicSlug } from "@/lib/recenzije/services/menus";

/**
 * Vrata jelovnika: gost upisuje broj mobitela i potvrđuje privolu, a mi ga (ako je sve u redu) pustimo u jelovnik.
 * Broj se nigdje ne zapisuje u log i ne vraća pregledniku; greške su kratke i mirne. Sama pohrana, privola, ograničenja
 * i zakazivanje poruke su u captureGuest.
 *
 * Dvije ulazne točke dijele istu obradu (`run`):
 *  - enterMenuAction: akcija obrasca (`<form action>`), radi i bez JavaScripta. Greška = preusmjeravanje na stranicu s ?greska=...
 *  - submitMenuGate: poziva je obrazac uz JavaScript i dobiva grešku kao vrijednost (bez ponovnog učitavanja stranice).
 * Obje na uspjehu postavljaju kolačić i preusmjeravaju na jelovnik.
 */

export type GateResult = {
  error: string;
  /** Polje na koje se greška odnosi (za fokus i aria-invalid). */
  field: "phone" | "consent" | null;
};

type ErrorCode = "telefon" | "privola" | "previse" | "greska";
type Outcome = { kind: "done"; slug: string } | { kind: "error"; slug: string | null; code: ErrorCode; table: string | null } & GateResult;

const ERRORS: Record<ErrorCode, GateResult> = {
  telefon: { error: GATE_MESSAGES.phone, field: "phone" },
  privola: { error: GATE_MESSAGES.consent, field: "consent" },
  previse: { error: GATE_MESSAGES.busy, field: null },
  greska: { error: GATE_MESSAGES.generic, field: null },
};

const formSchema = z.object({
  slug: z.string().max(GATE_LIMITS.slug),
  phone: z.string().max(GATE_LIMITS.phone),
  consent: z.string().max(10).optional(),
  stol: z.string().max(GATE_LIMITS.table).optional(),
  notices: z.string().max(10).optional(),
  web: z.string().max(GATE_LIMITS.honeypot).optional(),
});

function readForm(formData: FormData) {
  const raw: Record<string, string> = {};
  for (const key of ["slug", "phone", "consent", "stol", "notices", "web"]) {
    const v = formData.get(key);
    if (typeof v === "string") raw[key] = v;
  }
  return formSchema.safeParse(raw);
}

function fail(code: ErrorCode, slug: string | null, table: string | null = null): Outcome {
  return { kind: "error", slug, code, table, ...ERRORS[code] };
}

async function run(formData: FormData): Promise<Outcome> {
  const parsed = readForm(formData);
  if (!parsed.success) {
    // Predugo ili neispravno polje: najčešće je to broj. Slug i ostalo dolaze iz skrivenih polja koja gost ne dira.
    const field = parsed.error.issues[0]?.path[0];
    return fail(field === "phone" ? "telefon" : "greska", null);
  }
  const d = parsed.data;

  const slug = normalizePublicSlug(d.slug);
  if (!slug) return fail("greska", null);
  const table = cleanTable(d.stol);

  const consent = d.consent === "1" || d.consent === "on";
  const hasHoneypot = Boolean(d.web && d.web.trim());

  // Prije svega jeftina provjera oblika, da nepotpun obrazac ne ide u bazu. Bot s ispunjenim skrivenim poljem
  // preskače ovo i ide u captureGuest, koji mu vraća lažni uspjeh bez spremanja.
  if (!hasHoneypot) {
    if (!normalizeGuestPhone(d.phone)) return fail("telefon", slug, table);
    if (!consent) return fail("privola", slug, table);
  }

  const ip = await clientIp();
  // Zaštita baze od preplavljivanja pokušajima (neispravni unosi se inače ne bilježe). Blago: lokal dijeli jednu javnu IP adresu.
  if (!rateLimit(`jl:enter:${ip}`, 40, 60_000).ok) return fail("previse", slug, table);

  const h = await headers();
  let result: Awaited<ReturnType<typeof captureGuest>>;
  try {
    result = await captureGuest({
      slug,
      phone: d.phone,
      consent,
      noticesShown: d.notices === "1",
      table,
      ip,
      userAgent: h.get("user-agent"),
      honeypot: d.web ?? null,
    });
  } catch (e) {
    // Samo vrsta greške, nikad poruka (u njoj bi mogao završiti broj).
    console.error("[jelovnik] unos broja nije uspio", e instanceof Error ? e.name : typeof e);
    return fail("greska", slug, table);
  }

  // Zakazane poruke napreduju i bez vanjskog crona; poziv je ograničen na jednom u 15 s po procesu.
  kickDueRuns(25);

  switch (result.status) {
    case "invalid_phone":
      return fail("telefon", slug, table);
    case "consent_required":
      return fail("privola", slug, table);
    case "menu_not_found":
      return { kind: "done", slug }; // stranica sama odgovara s 404
    case "ok":
    case "rate_limited":
    case "cap_reached": {
      // Ograničenja zlouporabe ne smiju zaključati goste u lokalu: jelovnik im ostaje dostupan (kolačić se postavlja i tada),
      // samo se ništa dodatno ne sprema. Gostu se ne objašnjava zašto.
      const menuId = result.status === "ok" ? result.menuId : (await getPublicMenuInfoBySlug(slug))?.id;
      if (!menuId) return { kind: "done", slug };
      const jar = await cookies();
      jar.set(guestCookieName(menuId), signGuestCookie(menuId), guestCookieOptions());
      // Kratka potvrda s maskiranim brojem (samo kad je unos stvarno primljen); stranica je pročita pri prikazu.
      const masked = result.status === "ok" && result.outcome !== "ignored" ? maskPhone(normalizeGuestPhone(d.phone) ?? "") : "";
      jar.set(`${guestCookieName(menuId)}_ok`, masked || "-", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/jelovnik",
        maxAge: FLASH_MAX_AGE_SECONDS,
      });
      return { kind: "done", slug };
    }
  }
}

function destination(o: Outcome): string {
  if (o.kind === "done") return `/jelovnik/${o.slug}`;
  if (!o.slug) return "/jelovnik/-";
  return `/jelovnik/${o.slug}?greska=${o.code}${o.table ? `&stol=${encodeURIComponent(o.table)}` : ""}`;
}

/** Akcija obrasca bez JavaScripta (i prije hidracije): uvijek preusmjerava, greška se prenosi u ?greska=. */
export async function enterMenuAction(formData: FormData): Promise<void> {
  redirect(destination(await run(formData)));
}

/** Poziv iz obrasca uz JavaScript: uspjeh preusmjerava na jelovnik, greška se vraća kao vrijednost. */
export async function submitMenuGate(formData: FormData): Promise<GateResult> {
  const outcome = await run(formData);
  if (outcome.kind === "done") redirect(destination(outcome));
  return { error: outcome.error, field: outcome.field };
}

import "server-only";
import { createHmac } from "crypto";
import { and, count, desc, eq, gte, inArray, isNull, lt, min, or, sql } from "drizzle-orm";
import { z } from "zod";
import { VENUE_REVIEW_AUTOMATION, VENUE_REVIEW_TEMPLATE_KEY } from "@/lib/recenzije/automation/templates";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import {
  automationRuns,
  automations,
  clients,
  menuGuests,
  menus,
  messages,
  organizations,
  type GuestOutcome,
  type MessageStatus,
} from "@/lib/recenzije/db/schema";
import { derivedKey } from "@/lib/recenzije/env";
import { GUEST_CONSENT_VERSION, GUEST_RETENTION_MONTHS, guestConsentText } from "@/lib/recenzije/guest-consent";
import { verifyGuestCookie } from "@/lib/recenzije/guest-cookie";
import { createId } from "@/lib/recenzije/id";
import { maskPhone } from "@/lib/recenzije/menu-format";
import { ANONYMOUS_FIRST_NAME } from "@/lib/recenzije/messages";
import { toE164 } from "@/lib/recenzije/phone";
import { computeVenueSendAt, safeTimeZone } from "@/lib/recenzije/quiet-hours";
import { usage } from "./billing";
import { getPublicMenuInfoBySlug, type PublicMenuInfo } from "./menus";
import { isNumberOptedOut } from "./opted-out";

/**
 * Gosti jelovnika: unos broja na vratima (/jelovnik/<slug>), dokaz privole, klijent, zakazivanje JEDNOG zahtjeva za
 * recenziju (odgoda iz postavki jelovnika, nikad noću), ograničenja zlouporabe, popis za operatera i brisanje nakon
 * 12 mjeseci. Vrijeme je argument (`now`) svugdje gdje ga test treba kontrolirati.
 */

/** Ograničenja zlouporabe. Brojevi su namjerno blagi: svi gosti istog lokala dijele jednu javnu IP adresu (WiFi lokala). */
export const GUEST_LIMITS = {
  /** Unosa po IP adresi (HMAC) na sat. */
  ipPerHour: 20,
  /** Unosa istog broja na dan (svi lokali zajedno): sprječava da netko tuđi broj upiše po cijelom gradu. */
  phonePerDay: 3,
  /** Unosa po lokalu na dan (kliznih 24 sata). */
  venuePerDay: 300,
  /** Isti broj ne dobiva drugi zahtjev od istog lokala unutar toliko dana. */
  dedupeDays: 30,
} as const;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

// --- Ulaz ---

export type CaptureInput = {
  /** Adresa iz URL-a (/jelovnik/<slug>). */
  slug: string;
  /** Broj onako kako ga je gost upisao ("091 234 5678" ili "+49 ..."): normalizira se ovdje. */
  phone: string;
  /** Označena privola. Bez nje se ništa ne sprema. */
  consent: boolean;
  /** ?stol=<n>: samo informativno, sprema se uz unos i nigdje se ne koristi. */
  table?: string | null;
  /** IP klijenta (lib/recenzije/request.ts clientIp()); sprema se samo kao HMAC. */
  ip: string;
  userAgent?: string | null;
  /** Skriveno polje obrasca. Ako je išta upisano, riječ je o botu: vraća se lažni uspjeh, ništa se ne sprema. */
  honeypot?: string | null;
  now?: Date;
};

export type CaptureOutcome = GuestOutcome | "ignored";

/**
 * Rezultat unosa. `ok` znači da gost smije dalje (postavite kolačić i otvorite jelovnik), bez obzira je li poruka
 * zakazana: razlog (`outcome`) je samo za evidenciju i NE prikazuje se gostu (da ne otkrijemo je li se broj odjavio).
 * `rate_limited` i `cap_reached` su zaštita od zlouporabe: gostu pokažite kratku poruku, a jelovnik mu ipak
 * ostavite dostupnim (kolačić postavite i tada), jer ograničenje ne smije zaključati goste iz lokala.
 */
export type CaptureResult =
  | { status: "ok"; menuId: string; visitId: string | null; outcome: CaptureOutcome; sendAt: Date | null }
  | { status: "invalid_phone" }
  | { status: "consent_required" }
  | { status: "rate_limited"; scope: "ip" | "phone"; retryAfterSeconds: number }
  | { status: "cap_reached" }
  | { status: "menu_not_found" };

const cleanTable = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return /^[\p{L}\p{N} ._\-/]{1,20}$/u.test(t) ? t : null;
};

const captureSchema = z.object({
  slug: z.string().max(80),
  phone: z.string().max(40),
  consent: z.boolean(),
  table: z.string().max(40).nullish().transform(cleanTable).catch(null),
  ip: z.string().max(100).catch(""),
  userAgent: z.string().max(600).nullish().catch(null),
  honeypot: z.string().max(600).nullish().catch(null),
});

/**
 * Broj u E.164. Prihvaća "091 234 5678", "+385 91 234 5678", "+385 (0)91 ...", "00385 ...", "385912345678" i
 * međunarodne brojeve (+49 ...). Hrvatski broj mora biti mobilni (+385 9x ...) jer fiksni ne prima SMS; inače je
 * dovoljno 8 do 15 znamenki. Bez slova i drugih znakova.
 */
export function normalizeGuestPhone(raw: string): string | null {
  const text = raw.trim().replace(/\(0\)/g, "");
  if (!/^[+\d\s().\-/]{6,40}$/.test(text)) return null;
  const compact = text.replace(/[^\d+]/g, "");
  // "385912345678" bez plusa: pozivni broj je već upisan (inače bi toE164 dodao još jedan +385).
  const e164 = toE164(/^385\d{8,9}$/.test(compact) ? `+${compact}` : text, "385")?.replace(/^\+3850/, "+385") ?? null;
  if (!e164) return null;
  if (e164.startsWith("+385")) return /^\+3859\d{7,8}$/.test(e164) ? e164 : null;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** HMAC IP adrese (ključ iz SESSION_SECRET): ne može se vratiti u adresu, ali isti IP uvijek daje isti otisak. */
function hashIp(ip: string): string | null {
  const v = ip.trim();
  if (!v || v === "unknown") return null;
  return createHmac("sha256", derivedKey("nr-guest-ip")).update(v).digest("hex").slice(0, 32);
}

const shortUserAgent = (ua: string | null | undefined) => {
  const v = (ua ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
  return v || null;
};

// --- Automatizacija jelovnika ---

/** Automatizacija "Jelovnik: zahtjev za recenziju gostu" tvrtke; nastaje pri prvom unosu. Operater je vidi u Automatizacijama. */
export async function ensureVenueAutomation(organizationId: string): Promise<{ id: string; enabled: boolean }> {
  await ensureReviewsDb();
  const find = (tx: Pick<typeof db, "select">) =>
    tx
      .select({ id: automations.id, enabled: automations.enabled })
      .from(automations)
      .where(and(eq(automations.organizationId, organizationId), eq(automations.templateKey, VENUE_REVIEW_TEMPLATE_KEY)))
      .limit(1);
  const [existing] = await find(db);
  if (existing) return existing;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`nr-venue-automation:${organizationId}`})::bigint)`);
    const [again] = await find(tx);
    if (again) return again;
    const t = VENUE_REVIEW_AUTOMATION;
    const [row] = await tx
      .insert(automations)
      .values({
        organizationId,
        name: t.name,
        description: t.description,
        trigger: t.trigger,
        templateKey: t.key,
        enabled: true,
        steps: t.steps.map((s) => ({ ...s, id: createId() })) as never,
      })
      .returning({ id: automations.id, enabled: automations.enabled });
    return row;
  });
}

// --- Unos broja ---

/**
 * Unos broja na vratima jelovnika. Redoslijed: oblik ulaza → jelovnik (ugašen = menu_not_found) → honeypot → privola →
 * broj → ograničenja (IP, broj, lokal) → spremanje unosa s dokazom privole → klijent → zakazivanje (ili razlog zašto ne).
 * Sve što mijenja podatke jednog broja kod jednog lokala radi pod advisory lockom, pa dva istodobna unosa istog broja
 * ne mogu zakazati dvije poruke.
 *
 * Zakazuje se točno JEDAN zahtjev: nextRunAt = unos + odgoda jelovnika (60 do 240 min), a ako to pada u noćnu pauzu
 * (22:00 do 09:00), u 09:00 idućeg jutra. Poruku zatim šalje motor automatizacija (processDueRuns), uz sve postojeće
 * zaštite (odjava bilo gdje, neaktivna pretplata, SMS limit, demo). Nakon poziva pokrenite kickDueRuns() (after()).
 */
export async function captureGuest(input: CaptureInput): Promise<CaptureResult> {
  await ensureReviewsDb();
  const now = input.now ?? new Date();
  const parsed = captureSchema.safeParse({
    slug: String(input.slug ?? ""),
    phone: String(input.phone ?? ""),
    consent: input.consent === true,
    table: input.table,
    ip: input.ip,
    userAgent: input.userAgent,
    honeypot: input.honeypot,
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return field === "slug" ? { status: "menu_not_found" } : { status: "invalid_phone" };
  }
  const d = parsed.data;

  const menu = await getPublicMenuInfoBySlug(d.slug);
  if (!menu) return { status: "menu_not_found" };
  if (d.honeypot && d.honeypot.trim()) return { status: "ok", menuId: menu.id, visitId: null, outcome: "ignored", sendAt: null };
  if (!d.consent) return { status: "consent_required" };
  const phone = normalizeGuestPhone(d.phone);
  if (!phone) return { status: "invalid_phone" };

  const ipHash = hashIp(d.ip);
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const dayAgo = new Date(now.getTime() - DAY_MS);

  if (ipHash) {
    const [r] = await db
      .select({ n: count(), oldest: min(menuGuests.createdAt) })
      .from(menuGuests)
      .where(and(eq(menuGuests.ipHash, ipHash), gte(menuGuests.createdAt, hourAgo)));
    if (r.n >= GUEST_LIMITS.ipPerHour) return { status: "rate_limited", scope: "ip", retryAfterSeconds: retryAfter(r.oldest, HOUR_MS, now) };
  }
  const [byPhone] = await db
    .select({ n: count(), oldest: min(menuGuests.createdAt) })
    .from(menuGuests)
    .where(and(eq(menuGuests.phone, phone), gte(menuGuests.createdAt, dayAgo)));
  if (byPhone.n >= GUEST_LIMITS.phonePerDay) {
    return { status: "rate_limited", scope: "phone", retryAfterSeconds: retryAfter(byPhone.oldest, DAY_MS, now) };
  }
  const [byVenue] = await db
    .select({ n: count() })
    .from(menuGuests)
    .where(and(eq(menuGuests.menuId, menu.id), gte(menuGuests.createdAt, dayAgo)));
  if (byVenue.n >= GUEST_LIMITS.venuePerDay) return { status: "cap_reached" };

  const [menuRow] = await db.select({ organizationId: menus.organizationId }).from(menus).where(eq(menus.id, menu.id)).limit(1);
  if (!menuRow) return { status: "menu_not_found" };
  const organizationId = menuRow.organizationId;
  const [org] = await db
    .select({ id: organizations.id, timezone: organizations.timezone, isDemo: organizations.isDemo, googleReviewUrl: organizations.googleReviewUrl })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!org) return { status: "menu_not_found" };

  // Provjere koje ne ovise o broju rade se prije transakcije; zaštite u slanju (motor) ionako se ponavljaju pri slanju.
  const automation = await ensureVenueAutomation(organizationId);
  const plan = org.isDemo ? null : await usage(organizationId);
  const globallyOptedOut = await isNumberOptedOut(phone);
  const consentText = guestConsentText(menu.venueName, menu.delayMinutes);
  const tz = safeTimeZone(org.timezone);

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`nr-guest:${organizationId}:${phone}`})::bigint)`);

    // Klijent: ponovno se koristi postojeći (isti broj kod istog lokala); za broj odjavljen bilo gdje ne stvara se novi.
    let client: typeof clients.$inferSelect | undefined;
    if (!globallyOptedOut) {
      [client] = await tx.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.phone, phone))).limit(1);
      if (!client) {
        await tx
          .insert(clients)
          .values({ organizationId, firstName: ANONYMOUS_FIRST_NAME, lastName: "", phone, source: "menu" })
          .onConflictDoNothing();
        [client] = await tx.select().from(clients).where(and(eq(clients.organizationId, organizationId), eq(clients.phone, phone))).limit(1);
      }
    }

    const dedupeSince = new Date(now.getTime() - GUEST_LIMITS.dedupeDays * DAY_MS);
    let outcome: GuestOutcome;
    if (globallyOptedOut || !client || client.smsOptOut) outcome = "opted_out";
    else if (org.isDemo) outcome = "demo";
    else if (!org.googleReviewUrl) outcome = "no_review_url";
    else if (!plan || !plan.active) outcome = "inactive";
    else if (plan.smsUsed >= plan.smsLimit) outcome = "sms_limit";
    else if (!automation.enabled) outcome = "automation_off";
    else if (client.reviewStatus === "REVIEW_RECEIVED" || client.reviewStatus === "COMPLETED") outcome = "already_reviewed";
    else {
      const [sameVenue] = await tx
        .select({ id: menuGuests.id })
        .from(menuGuests)
        .innerJoin(automationRuns, eq(automationRuns.id, menuGuests.runId))
        .where(
          and(
            eq(menuGuests.organizationId, organizationId),
            eq(menuGuests.phone, phone),
            eq(menuGuests.outcome, "scheduled"),
            gte(menuGuests.createdAt, dedupeSince),
            inArray(automationRuns.status, ["RUNNING", "WAITING", "COMPLETED"])
          )
        )
        .limit(1);
      const [alreadyAsked] = sameVenue
        ? [sameVenue]
        : await tx
            .select({ id: messages.id })
            .from(messages)
            .where(
              and(
                eq(messages.organizationId, organizationId),
                eq(messages.clientId, client.id),
                eq(messages.direction, "OUTBOUND"),
                inArray(messages.kind, ["REVIEW_REQUEST", "CAMPAIGN"]),
                inArray(messages.status, ["QUEUED", "SENT", "DELIVERED"]),
                gte(messages.createdAt, dedupeSince)
              )
            )
            .limit(1);
      outcome = alreadyAsked ? "deduped" : "scheduled";
    }

    let runId: string | null = null;
    let sendAt: Date | null = null;
    if (outcome === "scheduled" && client) {
      sendAt = computeVenueSendAt(now, menu.delayMinutes, tz);
      const [run] = await tx
        .insert(automationRuns)
        .values({
          organizationId,
          automationId: automation.id,
          clientId: client.id,
          status: "WAITING",
          stepIndex: 0,
          nextRunAt: sendAt,
          startedAt: now,
          log: [
            {
              at: now.toISOString(),
              stepIndex: 0,
              type: "trigger",
              message: `Gost je upisao broj na jelovniku; zahtjev za recenziju zakazan za ${sendAt.toISOString()}`,
            },
          ],
        })
        .returning({ id: automationRuns.id });
      runId = run.id;
    }

    const [visit] = await tx
      .insert(menuGuests)
      .values({
        menuId: menu.id,
        organizationId,
        clientId: client?.id ?? null,
        phone,
        tableLabel: d.table ?? null,
        consentAt: now,
        consentVersion: GUEST_CONSENT_VERSION,
        consentText,
        ipHash,
        userAgent: shortUserAgent(d.userAgent),
        outcome,
        runId,
        sendAt,
        createdAt: now,
      })
      .returning({ id: menuGuests.id });
    return { visitId: visit.id, outcome, sendAt };
  });

  return { status: "ok", menuId: menu.id, ...result };
}

function retryAfter(oldest: Date | null, windowMs: number, now: Date): number {
  if (!oldest) return 60;
  return Math.max(60, Math.ceil((oldest.getTime() + windowMs - now.getTime()) / 1000));
}

// --- Vrata (tko smije vidjeti jelovnik) ---

export type MenuAccess =
  | { kind: "not_found" }
  | { kind: "gate"; menu: PublicMenuInfo; consentText: string }
  | { kind: "menu"; menu: PublicMenuInfo; via: "cookie" | "skip" };

/**
 * Odlučuje što stranica /jelovnik/<slug> prikazuje: 404, vrata (unos broja) ili jelovnik.
 * Jelovnik se prikazuje samo uz ispravan potpisani kolačić ovog jelovnika ili, ako je lokal dopustio pregled bez broja
 * (allow_skip), kad gost izričito odabere "Pogledaj jelovnik bez unosa broja" (`skip: true`). Preskakanje ništa ne sprema.
 */
export async function resolveMenuAccess(input: { slug: string; cookieValue?: string | null; skip?: boolean; now?: Date }): Promise<MenuAccess> {
  const menu = await getPublicMenuInfoBySlug(input.slug);
  if (!menu) return { kind: "not_found" };
  if (verifyGuestCookie(menu.id, input.cookieValue, (input.now ?? new Date()).getTime())) return { kind: "menu", menu, via: "cookie" };
  if (menu.allowSkip && input.skip) return { kind: "menu", menu, via: "skip" };
  return { kind: "gate", menu, consentText: guestConsentText(menu.venueName, menu.delayMinutes) };
}

// --- Popis za operatera ---

export const GUEST_OUTCOME_LABELS: Record<GuestOutcome, string> = {
  scheduled: "Zahtjev zakazan",
  deduped: "Već dobio zahtjev u zadnjih 30 dana",
  opted_out: "Odjavljen od SMS-ova",
  inactive: "Pretplata nije aktivna",
  sms_limit: "Dosegnut SMS limit",
  no_review_url: "Nedostaje link za Google recenzije",
  automation_off: "Automatizacija je isključena",
  already_reviewed: "Već je ostavio recenziju",
  demo: "Demo, ništa se ne šalje",
};

/** Sažetak stanja za jednu liniju u tablici: sent = poslano, waiting = čeka vrijeme, failed = slanje nije uspjelo, skipped = nije zakazano. */
export type GuestState = "sent" | "waiting" | "failed" | "skipped" | "cancelled";

export const GUEST_STATE_LABELS: Record<GuestState, string> = {
  sent: "Poslano",
  waiting: "Čeka slanje",
  failed: "Slanje nije uspjelo",
  skipped: "Nije zakazano",
  cancelled: "Otkazano",
};

export type GuestRow = {
  id: string;
  createdAt: Date;
  /** "+385 *** *** 567": vidljive su zadnje tri znamenke. */
  phoneMasked: string;
  table: string | null;
  outcome: GuestOutcome;
  outcomeLabel: string;
  sendAt: Date | null;
  state: GuestState;
  stateLabel: string;
  /** Razlog neuspjeha slanja (poruka motora), samo za state "failed". */
  error: string | null;
  messageStatus: MessageStatus | null;
};

/** Zadnji unosi za jednu tvrtku (najnoviji prvi), s maskiranim brojem i stanjem slanja. */
export async function listRecentGuests(organizationId: string, limit = 50, offset = 0): Promise<GuestRow[]> {
  await ensureReviewsDb();
  const rows = await db
    .select({
      id: menuGuests.id,
      createdAt: menuGuests.createdAt,
      phone: menuGuests.phone,
      table: menuGuests.tableLabel,
      outcome: menuGuests.outcome,
      sendAt: menuGuests.sendAt,
      runStatus: automationRuns.status,
      runError: automationRuns.error,
      messageStatus: sql<MessageStatus | null>`(select m.status from nr_messages m where m.automation_run_id = ${automationRuns.id} order by m.created_at desc limit 1)`,
      messageError: sql<string | null>`(select m.error_message from nr_messages m where m.automation_run_id = ${automationRuns.id} order by m.created_at desc limit 1)`,
    })
    .from(menuGuests)
    .leftJoin(automationRuns, eq(automationRuns.id, menuGuests.runId))
    .where(eq(menuGuests.organizationId, organizationId))
    .orderBy(desc(menuGuests.createdAt), desc(menuGuests.id))
    .limit(Math.min(200, Math.max(1, Math.floor(limit))))
    .offset(Math.max(0, Math.floor(offset)));
  return rows.map((r) => {
    const failed = r.runStatus === "FAILED" || r.messageStatus === "FAILED" || r.messageStatus === "UNDELIVERED";
    const state: GuestState =
      r.outcome !== "scheduled"
        ? "skipped"
        : failed
          ? "failed"
          : r.messageStatus === "SENT" || r.messageStatus === "DELIVERED"
            ? "sent"
            : r.runStatus === "WAITING" || r.runStatus === "RUNNING"
              ? "waiting"
              : "cancelled";
    return {
      id: r.id,
      createdAt: r.createdAt,
      phoneMasked: maskPhone(r.phone),
      table: r.table,
      outcome: r.outcome,
      outcomeLabel: GUEST_OUTCOME_LABELS[r.outcome] ?? r.outcome,
      sendAt: r.sendAt,
      state,
      stateLabel: GUEST_STATE_LABELS[state],
      error: state === "failed" ? (r.runError ?? r.messageError) : null,
      messageStatus: r.messageStatus,
    };
  });
}

export type GuestSummary = { total: number; last24h: number; last7d: number; scheduled: number; sent: number; waiting: number };

/** Brojke za zaglavlje stranice Gosti. */
export async function getGuestSummary(organizationId: string, now: Date = new Date()): Promise<GuestSummary> {
  await ensureReviewsDb();
  const d1 = new Date(now.getTime() - DAY_MS);
  const d7 = new Date(now.getTime() - 7 * DAY_MS);
  const [r] = await db
    .select({
      total: count(),
      last24h: sql<number>`count(*) filter (where ${gte(menuGuests.createdAt, d1)})::int`,
      last7d: sql<number>`count(*) filter (where ${gte(menuGuests.createdAt, d7)})::int`,
      scheduled: sql<number>`count(*) filter (where ${menuGuests.outcome} = 'scheduled')::int`,
      sent: sql<number>`count(*) filter (where exists (select 1 from nr_messages m where m.automation_run_id = ${automationRuns.id} and m.status in ('SENT', 'DELIVERED')))::int`,
      waiting: sql<number>`count(*) filter (where ${automationRuns.status} in ('WAITING', 'RUNNING'))::int`,
    })
    .from(menuGuests)
    .leftJoin(automationRuns, eq(automationRuns.id, menuGuests.runId))
    .where(eq(menuGuests.organizationId, organizationId));
  return { total: Number(r.total), last24h: r.last24h, last7d: r.last7d, scheduled: r.scheduled, sent: r.sent, waiting: r.waiting };
}

// --- Zadržavanje podataka ---

export type PurgeResult = { cutoff: Date; visits: number; clients: number; messages: number };

/**
 * Briše sve starije od 12 mjeseci: unose gostiju i klijente nastale s jelovnika (source = 'menu') zajedno s njihovim
 * porukama. Klijent se NE briše ako ima usluge (tim ga je u međuvremenu preuzeo kao pravog klijenta), ako mu je
 * zadnja poruka mlađa od roka, ako broj ima noviji unos ili ako se gost odjavio (redak ostaje kao evidencija odjave, ali
 * mu se stare poruke brišu). Klijenti koje je unio tim (source null) se nikad ne diraju.
 * Idempotentno: ponovljen poziv ne radi ništa dok ne zastari nešto novo. Poziva se iz dnevnog crona.
 */
export async function purgeOldGuestData(now: Date = new Date()): Promise<PurgeResult> {
  await ensureReviewsDb();
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - GUEST_RETENTION_MONTHS);

  return db.transaction(async (tx) => {
    const removedVisits = await tx.delete(menuGuests).where(lt(menuGuests.createdAt, cutoff)).returning({ id: menuGuests.id });
    const doomed = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.source, "menu"),
          // Odjavljeni gost ostaje kao evidencija odjave (samo broj i oznaka): bez nje bi se isti broj nakon 12 mjeseci
          // mogao ponovno upisati na jelovniku i dobiti poruku (isNumberOptedOut čita upravo ovaj redak).
          eq(clients.smsOptOut, false),
          lt(clients.createdAt, cutoff),
          or(isNull(clients.lastMessageAt), lt(clients.lastMessageAt, cutoff)),
          sql`not exists (select 1 from nr_services s where s.client_id = ${clients.id})`,
          sql`not exists (select 1 from nr_menu_guests g where g.organization_id = ${clients.organizationId} and g.phone = ${clients.phone})`
        )
      );
    let removedMessages = 0;
    let removedClients = 0;
    // Odjavljenima se brišu samo stare poruke (tekst poruke, status), a redak klijenta s odjavom ostaje.
    const kept = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(
        and(
          eq(clients.source, "menu"),
          eq(clients.smsOptOut, true),
          lt(clients.createdAt, cutoff),
          sql`not exists (select 1 from nr_services s where s.client_id = ${clients.id})`
        )
      );
    for (let i = 0; i < kept.length; i += 500) {
      const ids = kept.slice(i, i + 500).map((c) => c.id);
      const m = await tx.delete(messages).where(and(inArray(messages.clientId, ids), lt(messages.createdAt, cutoff))).returning({ id: messages.id });
      removedMessages += m.length;
    }
    for (let i = 0; i < doomed.length; i += 500) {
      const ids = doomed.slice(i, i + 500).map((c) => c.id);
      const m = await tx.delete(messages).where(inArray(messages.clientId, ids)).returning({ id: messages.id });
      const c = await tx.delete(clients).where(inArray(clients.id, ids)).returning({ id: clients.id });
      removedMessages += m.length;
      removedClients += c.length;
    }
    return { cutoff, visits: removedVisits.length, clients: removedClients, messages: removedMessages };
  });
}

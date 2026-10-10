"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentAdminRecord } from "@/lib/auth";
import { logActivity } from "@/lib/db/queries";
import { type ActionState, echoValues, formObject, zodErrors } from "@/lib/recenzije/action";
import { createSession } from "@/lib/recenzije/auth";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { organizationMembers, organizations, users } from "@/lib/recenzije/db/schema";
import { BUSINESS_TYPE_VALUES, industryFor, workspaceTargetFor } from "@/lib/recenzije/business-type";
import { DEMO_EMAIL, DEMO_SLUG } from "@/lib/recenzije/db/seed";
import { env, integrations } from "@/lib/recenzije/env";
import { toE164 } from "@/lib/recenzije/phone";
import { ACTIVE_ORG_COOKIE } from "@/lib/recenzije/session";
import { createManagedClient, ensureOperatorMember, updateClientDetails } from "@/lib/recenzije/services/clients-admin";
import { ensureVenueAutomation } from "@/lib/recenzije/services/guests";
import { ensureVenueMenu } from "@/lib/recenzije/services/menus";
import { registerNovoWebhooks } from "@/lib/recenzije/services/novo-phone";
import { checkTestSmsStatus, sendTestSms } from "@/lib/recenzije/services/sms-status";
import { listTextbeeDevices } from "@/lib/recenzije/services/textbee";
import { TEXTBEE_API_KEY_PATTERN, TEXTBEE_DEVICE_ID_PATTERN, scrubSecrets } from "@/lib/recenzije/textbee";
import {
  checkOrgTextbee,
  clearOrgTextbee,
  regenerateOrgWebhookSecret,
  revealOrgWebhookSecret,
  saveOrgTextbee,
} from "@/lib/recenzije/services/org-textbee";
import { estimateTwilioCostUsd, formatUsd } from "@/lib/recenzije/sms-format";
import { activatePlanManually, AdminError, changePlan, deactivate, extendFreePeriod } from "@/lib/recenzije/services/novo-admin";

/**
 * Radnje s /admin/recenzije. Smije ih samo glavni admin NOVO-a (isti uvjet kao Financije):
 * mijenjaju naplatu klijenata, otvaraju njihov radni prostor i šalju probni SMS preko SMS pošiljatelja.
 * Svaka radnja ponovno provjerava ovlast na serveru, ne oslanja se na to da je gumb skriven.
 */
async function requireSuperAdmin() {
  const admin = await getCurrentAdminRecord();
  if (!admin) redirect("/admin/login");
  if (!admin.isSuperAdmin) redirect("/admin");
  return admin;
}

/** Poruka koju smijemo pokazati adminu: naše greške da, sve drugo (npr. SQL s parametrima) ne. */
function safeMessage(e: unknown, fallback = "Nije uspjelo. Pokušajte ponovno.") {
  return e instanceof AdminError ? e.message : fallback;
}

/**
 * Greška vanjske usluge (Twilio, NOVO mobitel, TextBee): admin mora vidjeti pravi razlog (s uputom), ali ograničene duljine
 * i nikad s API ključem ili tajnom (scrubSecrets), čak i kad bi ih neka biblioteka ili odgovor slučajno uključili u poruku.
 */
function providerMessage(e: unknown, extraSecrets: Array<string | null | undefined> = []) {
  const m = e instanceof Error ? scrubSecrets(e.message.trim(), [env.textbeeApiKey, env.textbeeWebhookSecret, env.twilioToken, ...extraSecrets]) : "";
  return m ? m.slice(0, 700) : "Nepoznata greška.";
}

const orgId = z.string().trim().min(1, "Klijent nije pronađen.").max(40, "Klijent nije pronađen.");
const planKey = z.string().trim().min(1, "Odaberite paket").max(40, "Odaberite paket");

/** Cijeli broj u rasponu; prazno polje je `empty`. */
function intField(min: number, max: number, message: string, empty: number) {
  return z
    .string()
    .default("")
    .transform((v) => (v.trim() === "" ? empty : Number(v)))
    .pipe(z.number(message).int(message).min(min, message).max(max, message));
}

function firstIssue(err: z.ZodError) {
  return err.issues[0]?.message ?? "Neispravan unos.";
}

/**
 * Izvede radnju iz obične forme (bez JS-a) i vrati admina na popis s porukom. `k` je klijent
 * na kojeg se poruka odnosi: stranica je prikaže uz njegovu karticu i skrola do nje.
 */
async function run(fn: () => Promise<string>, adminEmail: string, action: string, clientId?: string) {
  const q = new URLSearchParams();
  try {
    const label = await fn();
    await logActivity({ adminEmail, action, targetLabel: label, propertyId: null }).catch(() => undefined);
    q.set("ok", label);
  } catch (e) {
    if (!(e instanceof AdminError)) console.error("[recenzije] admin radnja", action, e);
    q.set("greska", safeMessage(e));
  }
  const id = clientId && orgId.safeParse(clientId).success ? clientId : undefined;
  if (id) q.set("k", id);
  revalidatePath("/admin/recenzije");
  revalidatePath("/recenzije", "layout");
  redirect(`/admin/recenzije?${q.toString()}${id ? `#klijent-${encodeURIComponent(id)}` : ""}`);
}

// --- Paket i plaćanje po klijentu ---

const activateSchema = z.object({
  orgId,
  planKey,
  months: intField(1, 24, "Mjeseci: upišite broj od 1 do 24", 1),
});

export async function activatePlanAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const raw = formObject(formData);
  await run(
    async () => {
      const d = activateSchema.safeParse(raw);
      if (!d.success) throw new AdminError(firstIssue(d.error));
      return activatePlanManually(d.data.orgId, d.data.planKey, d.data.months);
    },
    admin.email,
    "Recenzije: aktiviran plaćeni paket",
    raw.orgId
  );
}

const freePeriodSchema = z.object({
  orgId,
  planKey,
  days: intField(1, 90, "Dani: upišite broj od 1 do 90", 14),
});

export async function extendFreePeriodAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const raw = formObject(formData);
  await run(
    async () => {
      const d = freePeriodSchema.safeParse(raw);
      if (!d.success) throw new AdminError(firstIssue(d.error));
      return extendFreePeriod(d.data.orgId, d.data.planKey, d.data.days);
    },
    admin.email,
    "Recenzije: besplatno razdoblje",
    raw.orgId
  );
}

const changePlanSchema = z.object({ orgId, planKey });

export async function changePlanAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const raw = formObject(formData);
  await run(
    async () => {
      const d = changePlanSchema.safeParse(raw);
      if (!d.success) throw new AdminError(firstIssue(d.error));
      return changePlan(d.data.orgId, d.data.planKey);
    },
    admin.email,
    "Recenzije: promijenjen paket",
    raw.orgId
  );
}

export async function deactivateAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const raw = formObject(formData);
  await run(
    async () => {
      const d = z.object({ orgId }).safeParse(raw);
      if (!d.success) throw new AdminError(firstIssue(d.error));
      return deactivate(d.data.orgId);
    },
    admin.email,
    "Recenzije: ugašena pretplata",
    raw.orgId
  );
}

// --- Novi klijent ---

const reviewUrl = z
  .string()
  .trim()
  .max(500, "Najviše 500 znakova")
  .refine(
    (v) => v === "" || /^https:\/\/(g\.page|search\.google\.com|www\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+)\//.test(v),
    "Upišite Google link za recenzije (https://g.page/r/… ili https://search.google.com/local/writereview?placeid=…)"
  );

const contactEmail = z.string().trim().toLowerCase().email("Upišite ispravnu email adresu").max(200, "Najviše 200 znakova");

const createClientSchema = z.object({
  name: z.string().trim().min(2, "Upišite naziv tvrtke").max(80, "Najviše 80 znakova"),
  industry: z.string().trim().max(60, "Najviše 60 znakova").optional().default(""),
  phone: z.string().trim().max(30, "Najviše 30 znakova").optional().default(""),
  googleReviewUrl: reviewUrl.optional().default(""),
  contactName: z.string().trim().min(2, "Upišite ime kontakt osobe").max(80, "Najviše 80 znakova"),
  contactEmail,
  contactPhone: z.string().trim().max(30, "Najviše 30 znakova").optional().default(""),
  planKey,
  freeDays: intField(0, 90, "Upišite broj dana od 0 do 90", 0),
  paidMonths: intField(1, 24, "Upišite broj mjeseci od 1 do 24", 1),
  /** Vrsta poslovanja: "venue" uključuje digitalni jelovnik (is_venue). Izostavljeno = usluga / obrt, kao i prije. */
  businessType: z.enum(BUSINESS_TYPE_VALUES, { error: "Odaberite vrstu poslovanja" }).optional().default("service"),
});

/** Odgovor nosi `data.orgId` da forma može odmah ponuditi "Otvori radni prostor" (i "Otvori jelovnik" za ugostiteljstvo). */
export async function createClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const parsed = createClientSchema.safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };
  const d = parsed.data;

  const phone = d.phone ? toE164(d.phone) : null;
  if (d.phone && !phone) return { values: echoValues(fd), fieldErrors: { phone: "Upišite ispravan broj telefona" } };
  const contactPhone = d.contactPhone ? toE164(d.contactPhone) : null;
  if (d.contactPhone && !contactPhone) {
    return { values: echoValues(fd), fieldErrors: { contactPhone: "Upišite ispravan broj telefona" } };
  }

  try {
    const created = await createManagedClient({
      name: d.name,
      // Ugostiteljstvo bez upisane djelatnosti dobiva zadanu ("Ugostiteljstvo"), da kartica klijenta ne ostane prazna.
      industry: industryFor(d.industry, d.businessType),
      phone,
      googleReviewUrl: d.googleReviewUrl || null,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      contactPhone,
      planKey: d.planKey,
      freeDays: d.freeDays,
      paidMonths: d.paidMonths,
      isVenue: d.businessType === "venue",
    });
    await logActivity({
      adminEmail: admin.email,
      action: d.businessType === "venue" ? "Recenzije: novi klijent (ugostiteljstvo)" : "Recenzije: novi klijent",
      targetLabel: created.summary,
      propertyId: null,
    }).catch(() => undefined);
    revalidatePath("/admin/recenzije");
    const venueHint = d.businessType === "venue" ? " Jelovnik se uređuje u radnom prostoru (stavka Jelovnik)." : "";
    return {
      ok: true,
      message: `Klijent je dodan. ${created.summary}${venueHint}`,
      data: { orgId: created.id, isVenue: d.businessType === "venue" },
    };
  } catch (e) {
    if (!(e instanceof AdminError)) console.error("[recenzije] novi klijent", e);
    return { values: echoValues(fd), error: safeMessage(e, "Klijent nije dodan. Pokušajte ponovno.") };
  }
}

// --- Kontakt, bilješka i vrsta poslovanja ---

/**
 * Klijent je (sada) ugostiteljstvo: osiguraj jelovnik i njegovu automatizaciju te zadanu djelatnost ako je prazna. Idempotentno.
 * Greška ovdje ne smije poništiti već spremljenu izmjenu: jelovnik i automatizacija ionako nastaju pri prvom otvaranju
 * jelovnika odnosno prvom unosu broja.
 */
async function prepareVenue(organizationId: string) {
  try {
    await db
      .update(organizations)
      .set({ industry: industryFor("", "venue") })
      .where(and(eq(organizations.id, organizationId), sql`coalesce(length(trim(${organizations.industry})), 0) = 0`));
    await ensureVenueMenu(organizationId);
    await ensureVenueAutomation(organizationId);
  } catch (e) {
    console.error("[recenzije] priprema jelovnika klijenta", e);
  }
}

const detailsSchema = z.object({
  orgId,
  contactName: z.string().trim().min(2, "Upišite ime kontakt osobe").max(80, "Najviše 80 znakova"),
  contactEmail,
  contactPhone: z.string().trim().max(30, "Najviše 30 znakova").optional().default(""),
  internalNote: z.string().trim().max(2000, "Najviše 2000 znakova").optional().default(""),
  /** Izostavljeno = vrsta poslovanja se ne mijenja (npr. kad se vrsta nije mogla pročitati). */
  businessType: z.enum(BUSINESS_TYPE_VALUES, { error: "Odaberite vrstu poslovanja" }).optional(),
});

export async function updateClientDetailsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const parsed = detailsSchema.safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };
  const d = parsed.data;
  const contactPhone = d.contactPhone ? toE164(d.contactPhone) : null;
  if (d.contactPhone && !contactPhone) {
    return { values: echoValues(fd), fieldErrors: { contactPhone: "Upišite ispravan broj telefona" } };
  }
  try {
    const name = await updateClientDetails(d.orgId, {
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      contactPhone,
      internalNote: d.internalNote || null,
      isVenue: d.businessType === undefined ? undefined : d.businessType === "venue",
    });
    if (d.businessType === "venue") await prepareVenue(d.orgId);
    await logActivity({
      adminEmail: admin.email,
      action: d.businessType === undefined ? "Recenzije: uređen kontakt klijenta" : `Recenzije: uređen klijent (${d.businessType === "venue" ? "ugostiteljstvo" : "usluga / obrt"})`,
      targetLabel: name,
      propertyId: null,
    }).catch(() => undefined);
    revalidatePath("/admin/recenzije");
    // Radni prostor čita vrstu poslovanja pri svakom prikazu (stavka "Jelovnik" u izborniku), pa ga osvježi i ovdje.
    revalidatePath("/recenzije", "layout");
    return { ok: true, message: "Spremljeno." };
  } catch (e) {
    if (!(e instanceof AdminError)) console.error("[recenzije] kontakt klijenta", e);
    return { values: echoValues(fd), error: safeMessage(e, "Nije spremljeno. Pokušajte ponovno.") };
  }
}

// --- Otvaranje radnog prostora ---

const orgCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * "Otvori radni prostor": NOVO tim ulazi u pravu aplikaciju (/recenzije) kao interni operater,
 * s aktivnom tvrtkom tog klijenta. Tako se klijenti, slanje, poruke i recenzije vode istim
 * zaslonima kao i prije, samo što ih umjesto klijenta koristi NOVO. Samo glavni admin. Neobavezno polje `redirectTo`
 * bira stranicu na koju se ulazi (zadano pregled; "/recenzije/jelovnik" za ugostiteljstvo), samo s popisa WORKSPACE_TARGETS.
 */
export async function openWorkspaceAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const raw = formObject(formData);
  const parsed = z.object({ orgId }).safeParse(raw);
  if (!parsed.success) redirect(`/admin/recenzije?greska=${encodeURIComponent(firstIssue(parsed.error))}`);
  const id = parsed.data.orgId;
  // Neobavezno odredište ("Jelovnik" na kartici ugostiteljskog klijenta): samo s fiksnog popisa internih putanja.
  const target = workspaceTargetFor(raw.redirectTo);
  if (!target) redirect(`/admin/recenzije?greska=${encodeURIComponent("Nepoznato odredište.")}&k=${encodeURIComponent(id)}#klijent-${encodeURIComponent(id)}`);

  let operatorId: string | null = null;
  let failure: string | null = null;
  try {
    operatorId = await ensureOperatorMember(id);
  } catch (e) {
    if (!(e instanceof AdminError)) console.error("[recenzije] otvaranje radnog prostora", e);
    failure = safeMessage(e, "Radni prostor se nije otvorio. Pokušajte ponovno.");
  }
  if (!operatorId) {
    redirect(`/admin/recenzije?greska=${encodeURIComponent(failure ?? "Radni prostor se nije otvorio.")}&k=${encodeURIComponent(id)}#klijent-${encodeURIComponent(id)}`);
  }

  await createSession(operatorId);
  (await cookies()).set(ACTIVE_ORG_COOKIE, id, orgCookie);
  await logActivity({
    adminEmail: admin.email,
    action: "Recenzije: otvoren radni prostor",
    targetLabel: id,
    propertyId: null,
  }).catch(() => undefined);
  redirect(target);
}

/** Demo (Donald's Cooling) se otvara kao i na javnoj stranici: pod demo korisnikom, samo za čitanje. */
export async function openDemoAction() {
  await requireSuperAdmin();
  await ensureReviewsDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, DEMO_SLUG)).limit(1);
  const [member] =
    user && org
      ? await db
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.organizationId, org.id)))
          .limit(1)
      : [];
  if (!user || !org || !member) {
    redirect(`/admin/recenzije?greska=${encodeURIComponent(env.demoEnabled ? "Demo nije pronađen." : "Demo je isključen (NR_DEMO=false).")}`);
  }
  await createSession(user.id);
  (await cookies()).set(ACTIVE_ORG_COOKIE, org.id, orgCookie);
  redirect("/recenzije/pregled");
}

// --- SMS pošiljatelj (Twilio, TextBee ili NOVO Android mobitel) ---

const testSmsSchema = z.object({ to: z.string().trim().min(1, "Upišite broj telefona").max(30, "Najviše 30 znakova") });

/**
 * Probni SMS preko AKTIVNOG pružatelja (Twilio, TextBee ili NOVO mobitel). Pravu grešku (npr. Twilio 21408 ili 21612,
 * TextBee pogrešan ključ ili ID uređaja, mobitel nedostupan) pokazujemo adminu s uputom. Uspjeh vraća pružatelja, oznaku poruke i status.
 */
export async function sendTestSmsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = testSmsSchema.safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };
  const to = toE164(parsed.data.to);
  if (!to) return { values: echoValues(fd), fieldErrors: { to: "Upišite ispravan broj telefona" } };
  try {
    const res = await sendTestSms(to);
    const via = `${res.providerLabel}${res.senderLabel ? `, pošiljatelj: ${res.senderLabel}` : ""}`;
    const cost =
      res.provider === "twilio"
        ? ` Procjena troška: ${formatUsd(estimateTwilioCostUsd(res.segments))}.`
        : res.provider === "textbee"
          ? " Trošak ide po tarifi vašeg SIM-a."
          : "";
    const next =
      res.provider === "twilio"
        ? " Za nekoliko sekundi kliknite „Provjeri status” da vidite je li poruka stvarno stigla."
        : res.provider === "textbee"
          ? ` Poruku prvo preuzima TextBee, a mobitel je šalje preko svog SIM-a: provjerite stiže li na primateljev mobitel.${integrations.textbeeInbound() ? "" : " Webhook nije postavljen, pa se isporuka ne prati u sustavu."}`
          : "";
    return {
      ok: true,
      message: `Poslano na ${to} (${via}). Status: ${res.status}, oznaka: ${res.sid}.${cost}${next}`,
      values: { to: parsed.data.to },
      data: { sid: res.sid, provider: res.provider },
    };
  } catch (e) {
    return { values: echoValues(fd), error: `Slanje nije uspjelo: ${providerMessage(e)}` };
  }
}

const checkStatusSchema = z.object({ sid: z.string().trim().regex(/^[A-Za-z0-9_-]{6,64}$/, "Neispravna oznaka poruke") });

/** Provjera probnog SMS-a kod Twilija: status isporuke i razlog ako nije stigao. */
export async function checkSmsStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = checkStatusSchema.safeParse(formObject(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Neispravna oznaka poruke" };
  try {
    const r = await checkTestSmsStatus(parsed.data.sid);
    return r.ok ? { ok: true, message: r.text } : { error: r.text };
  } catch (e) {
    return { error: `Provjera nije uspjela: ${providerMessage(e)}` };
  }
}

/**
 * Samo čitanje: popis uređaja računa na TextBeeu (GET /gateway/devices), da vlasnik može kopirati ID uređaja za
 * TEXTBEE_DEVICE_ID. API ključ se nikad ne vraća ni ne prikazuje; greške su čitljive i bez ključa.
 */
export async function listTextbeeDevicesAction(): Promise<ActionState> {
  await requireSuperAdmin();
  try {
    const devices = await listTextbeeDevices();
    const current = env.textbeeDeviceId || null;
    return {
      ok: true,
      message:
        devices.length > 0
          ? `Pronađeno uređaja: ${devices.length}.`
          : "TextBee ne vidi nijedan uređaj na ovom računu. U aplikaciji na mobitelu prijavite se istim računom i uključite Gateway.",
      data: {
        devices: devices.map((d) => ({ ...d, current: d.id === current })),
        configuredDeviceId: current,
      },
    };
  } catch (e) {
    return { error: `Provjera uređaja nije uspjela: ${providerMessage(e)}` };
  }
}

export async function registerWebhooksAction(): Promise<ActionState> {
  await requireSuperAdmin();
  try {
    await registerNovoWebhooks();
    return { ok: true, message: "Webhookovi su povezani s NOVO mobitelom." };
  } catch (e) {
    return { error: `Povezivanje nije uspjelo: ${providerMessage(e)}` };
  }
}

// --- TextBee mobitel jednog klijenta (poruke tog klijenta odlaze s njegova broja) ---

const textbeeDeviceId = z
  .string()
  .trim()
  .min(1, "Upišite ID uređaja")
  .max(100, "ID uređaja je predug")
  .regex(TEXTBEE_DEVICE_ID_PATTERN, "ID uređaja smije imati samo slova, brojke, „-” i „_”");

/** Prazan ključ = zadrži spremljeni (ključ se nikad ne prikazuje u formi). */
const textbeeApiKey = z
  .string()
  .trim()
  .refine((v) => v === "" || TEXTBEE_API_KEY_PATTERN.test(v), "API ključ mora imati 8 do 200 znakova bez razmaka");

/** U formu se vraća samo ID uređaja; API ključ se nikad ne vraća, ni pri grešci. */
const echoDevice = (fd: FormData) => ({ deviceId: String(fd.get("deviceId") ?? "") });

const saveTextbeeSchema = z.object({ orgId, apiKey: textbeeApiKey.optional().default(""), deviceId: textbeeDeviceId });

/**
 * Sprema TextBee mobitel klijenta (API ključ šifriran, ID uređaja). Pri prvom spremanju nastaje i tajna webhooka, koju vraća `data.secret`
 * da je admin odmah može upisati u TextBee. Od tog trenutka poruke tog klijenta idu s TOG mobitela (pa Provjeri vezu i probni SMS prije prave pošiljke).
 */
export async function saveOrgTextbeeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const parsed = saveTextbeeSchema.safeParse(formObject(fd));
  if (!parsed.success) return { values: echoDevice(fd), fieldErrors: zodErrors(parsed.error) };
  const d = parsed.data;
  try {
    const res = await saveOrgTextbee(d.orgId, { apiKey: d.apiKey || null, deviceId: d.deviceId });
    await logActivity({
      adminEmail: admin.email,
      action: "Recenzije: spremljen TextBee mobitel klijenta",
      targetLabel: res.name,
      propertyId: null,
    }).catch(() => undefined);
    revalidatePath("/admin/recenzije");
    revalidatePath("/recenzije", "layout");
    return {
      ok: true,
      message: res.secretCreated
        ? "Spremljeno. Poruke ovog klijenta od sada idu s ovog mobitela. Napravite webhook u TextBeeu (koraci ispod) da STOP i isporuka rade."
        : "Spremljeno.",
      values: { deviceId: d.deviceId },
    };
  } catch (e) {
    if (!(e instanceof AdminError)) console.error("[recenzije] TextBee mobitel klijenta", e instanceof Error ? e.name : typeof e);
    return { values: echoDevice(fd), error: safeMessage(e, "Nije spremljeno. Pokušajte ponovno.") };
  }
}

const checkTextbeeSchema = z.object({
  orgId,
  apiKey: textbeeApiKey.optional().default(""),
  deviceId: z.string().trim().max(100, "ID uređaja je predug").optional().default(""),
});

/**
 * Provjera veze (samo čitanje, nikakav SMS): TextBee vrati popis uređaja računa, a ovdje se vidi postoji li među njima upisani ID. Koristi
 * ključ upisan u formi, a ako je prazan, spremljeni.
 */
export async function checkOrgTextbeeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = checkTextbeeSchema.safeParse(formObject(fd));
  if (!parsed.success) return { values: echoDevice(fd), fieldErrors: zodErrors(parsed.error) };
  const d = parsed.data;
  try {
    const r = await checkOrgTextbee(d.orgId, { apiKey: d.apiKey || null, deviceId: d.deviceId || null });
    if (!r.found) {
      return {
        values: echoDevice(fd),
        error:
          r.total === 0
            ? "Ključ radi, ali TextBee ne vidi nijedan uređaj na tom računu. U aplikaciji na mobitelu prijavite se istim računom i uključite Gateway."
            : `Ključ radi, ali uređaj s tim ID-om nije na računu. Uređaji na računu: ${r.others.map((o) => `${o.name} (ID: ${o.id})`).join("; ")}.`,
      };
    }
    const dev = r.device!;
    const state = [
      dev.enabled === true ? "uključen" : dev.enabled === false ? "isključen (uključite Gateway u aplikaciji na mobitelu)" : null,
      dev.online === true ? "vjerojatno online" : dev.online === false ? "dugo bez signala" : null,
    ].filter(Boolean);
    return {
      ok: true,
      message: `Veza radi. Uređaj „${dev.name}” je pronađen${state.length ? ` (${state.join(", ")})` : ""}. Nijedna poruka nije poslana.`,
      values: echoDevice(fd),
    };
  } catch (e) {
    return { values: echoDevice(fd), error: `Provjera nije uspjela: ${providerMessage(e, [String(fd.get("apiKey") ?? "")])}` };
  }
}

const orgTestSchema = z.object({ orgId, to: z.string().trim().min(1, "Upišite broj telefona").max(30, "Najviše 30 znakova") });

/** Probni SMS preko pružatelja OVOG klijenta (njegov TextBee mobitel ima prednost; nema vraćanja na drugi broj). */
export async function sendOrgTestSmsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = orgTestSchema.safeParse(formObject(fd));
  if (!parsed.success) return { values: { to: String(fd.get("to") ?? "") }, fieldErrors: zodErrors(parsed.error) };
  const to = toE164(parsed.data.to);
  if (!to) return { values: { to: parsed.data.to }, fieldErrors: { to: "Upišite ispravan broj telefona" } };
  try {
    await ensureReviewsDb();
    const [org] = await db.select().from(organizations).where(eq(organizations.id, parsed.data.orgId)).limit(1);
    if (!org) return { values: { to: parsed.data.to }, error: "Klijent nije pronađen." };
    if (org.isDemo) return { values: { to: parsed.data.to }, error: "Demo je samo za razgledavanje: stvarni SMS se ne šalje." };
    const res = await sendTestSms(to, org);
    const via = `${res.providerLabel}${res.senderLabel ? `, pošiljatelj: ${res.senderLabel}` : ""}`;
    const next =
      res.provider === "textbee"
        ? " Poruku prvo preuzima TextBee, a mobitel je šalje preko svog SIM-a: provjerite stiže li na primateljev mobitel."
        : "";
    return { ok: true, message: `Poslano na ${to} (${via}). Status: ${res.status}.${next}`, values: { to: parsed.data.to } };
  } catch (e) {
    return { values: { to: parsed.data.to }, error: `Slanje nije uspjelo: ${providerMessage(e)}` };
  }
}

/** Nova tajna webhooka (stara odmah prestaje vrijediti: novu treba upisati u TextBee). Tajna je namijenjena adminu i vraća se u `data.secret`. */
export async function regenerateOrgSecretAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireSuperAdmin();
  const parsed = z.object({ orgId }).safeParse(formObject(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    const res = await regenerateOrgWebhookSecret(parsed.data.orgId);
    await logActivity({
      adminEmail: admin.email,
      action: "Recenzije: nova tajna webhooka (TextBee klijenta)",
      targetLabel: res.name,
      propertyId: null,
    }).catch(() => undefined);
    revalidatePath("/admin/recenzije");
    return { ok: true, message: "Nova tajna je spremljena. Upišite je u webhook u TextBeeu, inače odgovori i isporuka ne stižu.", data: { secret: res.secret } };
  } catch (e) {
    if (!(e instanceof AdminError)) console.error("[recenzije] nova tajna webhooka", e instanceof Error ? e.name : typeof e);
    return { error: safeMessage(e) };
  }
}

/** Prikaz tajne webhooka za kopiranje u TextBee (tajna nije u HTML-u stranice dok je admin ne zatraži). */
export async function revealOrgSecretAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = z.object({ orgId }).safeParse(formObject(fd));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    return { ok: true, data: { secret: await revealOrgWebhookSecret(parsed.data.orgId) } };
  } catch (e) {
    if (!(e instanceof AdminError)) console.error("[recenzije] prikaz tajne webhooka", e instanceof Error ? e.name : typeof e);
    return { error: safeMessage(e) };
  }
}

/** Ukloni mobitel klijenta: njegove poruke od sada idu sljedećim pružateljem (zajednički NOVO mobitel, TextBee ili Twilio). */
export async function removeOrgTextbeeAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const raw = formObject(formData);
  await run(
    async () => {
      const d = z.object({ orgId }).safeParse(raw);
      if (!d.success) throw new AdminError(firstIssue(d.error));
      const name = await clearOrgTextbee(d.data.orgId);
      return `Mobitel klijenta ${name} je uklonjen. Njegove poruke od sada idu zajedničkim pošiljateljem.`;
    },
    admin.email,
    "Recenzije: uklonjen TextBee mobitel klijenta",
    raw.orgId
  );
}

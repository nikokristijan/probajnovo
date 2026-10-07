"use server";

import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession } from "@/lib/recenzije/auth";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { DEMO_EMAIL, DEMO_SLUG } from "@/lib/recenzije/db/seed";
import { organizationMembers, organizations, passwordResetTokens, users } from "@/lib/recenzije/db/schema";
import { type ActionState, echoValues, formObject, zodErrors } from "@/lib/recenzije/action";
import { randomToken, sha256 } from "@/lib/recenzije/crypto";
import { env } from "@/lib/recenzije/env";
import { rateLimit } from "@/lib/recenzije/rate-limit";
import { clientIp } from "@/lib/recenzije/request";
import { ACTIVE_ORG_COOKIE } from "@/lib/recenzije/session";
import { sendEmail } from "@/lib/recenzije/services/email";
import { consumeInviteCode, isInviteCodeUsable } from "@/lib/recenzije/services/invites";
import { escapeHtml } from "@/lib/recenzije/utils";

const email = z.string().trim().toLowerCase().email("Upišite ispravnu email adresu").max(200);
const password = z
  .string()
  .min(8, "Najmanje 8 znakova")
  .max(200)
  .refine((p) => /[A-Za-zčćšžđČĆŠŽĐ]/.test(p) && /\d/.test(p), "Koristite slova i barem jedan broj");

/** Nakon prijave dopuštamo samo relativne putanje unutar /recenzije (bez open redirecta). */
function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/recenzije/") || next.startsWith("//") || next.includes("\\")) return "/recenzije/pregled";
  return next;
}

const DUMMY_HASH = "$2b$12$o3A3f6CFL7ES1CsuU2uFEOY2fCyzMIhhR1a3drg8.rwJ1ij2I74N2";

async function limited(bucket: string, limit: number, windowMs: number): Promise<string | null> {
  const ip = await clientIp();
  const r = rateLimit(`${bucket}:${ip}`, limit, windowMs);
  return r.ok ? null : `Previše pokušaja. Pokušajte ponovno za ${Math.ceil(r.retryAfter / 60)} min.`;
}

/** Isti tekst za svaki razlog odbijanja (nepoznat, istekao, opozvan, iskorišten): ne otkrivamo koji kodovi postoje. */
const INVITE_ERROR = "Pozivni kod nije ispravan ili više ne vrijedi. Javite nam se na " + env.salesEmail;
const EMAIL_TAKEN_ERROR = "Račun s ovim emailom već postoji. Prijavite se.";

/** Baca se unutar transakcije registracije da se poništi i upotreba pozivnog koda. */
class SignupConflict extends Error {
  constructor(readonly field: "invite" | "email") {
    super(field);
  }
}

export async function signupAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await ensureReviewsDb();
  const tooMany = await limited("signup", 5, 15 * 60_000);
  if (tooMany) return { values: echoValues(fd), error: tooMany };
  const parsed = z
    .object({ name: z.string().trim().min(2, "Upišite ime i prezime").max(80), email, password, invite: z.string().trim().max(100).default("") })
    .safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };

  // Prvo samo provjera (bez trošenja): neispravan kod ne smije otkriti postoji li email.
  if (!(await isInviteCodeUsable(parsed.data.invite))) {
    return { values: echoValues(fd), fieldErrors: { invite: INVITE_ERROR } };
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing) return { values: echoValues(fd), fieldErrors: { email: EMAIL_TAKEN_ERROR } };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  let userId: string;
  try {
    // Potrošnja koda i upis korisnika u jednoj transakciji: ako upis padne, upotreba se vraća sama.
    userId = await db.transaction(async (tx) => {
      const used = await consumeInviteCode(tx, parsed.data.invite, parsed.data.email);
      if (!used) throw new SignupConflict("invite"); // netko ga je u međuvremenu iskoristio ili opozvao
      const [user] = await tx
        .insert(users)
        .values({ name: parsed.data.name, email: parsed.data.email, passwordHash })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      if (!user) throw new SignupConflict("email"); // istovremena registracija s istim emailom
      return user.id;
    });
  } catch (e) {
    if (e instanceof SignupConflict) {
      return {
        values: echoValues(fd),
        fieldErrors: e.field === "invite" ? { invite: INVITE_ERROR } : { email: EMAIL_TAKEN_ERROR },
      };
    }
    throw e;
  }
  await createSession(userId);
  redirect("/recenzije/postavljanje");
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await ensureReviewsDb();
  const tooMany = await limited("login", 10, 15 * 60_000);
  if (tooMany) return { values: echoValues(fd), error: tooMany };
  const parsed = z
    .object({ email, password: z.string().min(1, "Upišite lozinku").max(200), next: z.string().optional() })
    .safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  // Uvijek usporedi hash (i kad korisnik ne postoji) da vrijeme odgovora ne otkriva postoji li račun.
  const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok) return { values: echoValues(fd), error: "Email ili lozinka nisu točni." };
  await createSession(user.id);
  redirect(safeNext(parsed.data.next));
}

/** Ulaz u demo bez lozinke: demo je samo za čitanje i iz njega se ništa ne šalje. */
export async function demoLoginAction() {
  if (!env.demoEnabled) redirect("/recenzije/prijava");
  await ensureReviewsDb();
  const tooMany = await limited("demo", 30, 15 * 60_000);
  if (tooMany) redirect("/recenzije/prijava?error=rate");
  const [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, DEMO_SLUG)).limit(1);
  if (!user || !org) redirect("/recenzije/prijava?error=demo");
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.organizationId, org.id)))
    .limit(1);
  if (!member) redirect("/recenzije/prijava?error=demo");
  await createSession(user.id);
  (await cookies()).set(ACTIVE_ORG_COOKIE, org.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect("/recenzije/pregled");
}

export async function logoutAction() {
  await destroySession();
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  redirect("/recenzije/prijava");
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await ensureReviewsDb();
  const tooMany = await limited("forgot", 5, 15 * 60_000);
  if (tooMany) return { values: echoValues(fd), error: tooMany };
  const parsed = z.object({ email }).safeParse(formObject(fd));
  if (!parsed.success) return { values: echoValues(fd), fieldErrors: zodErrors(parsed.error) };

  // Isti odgovor postojao račun ili ne (ne otkrivamo tko ima račun).
  const generic: ActionState = {
    ok: true,
    message: "Ako postoji račun s tim emailom, poslali smo poveznicu za novu lozinku. Vrijedi 1 sat.",
  };
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!user || user.email === DEMO_EMAIL) return generic;

  const token = randomToken(32);
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 60 * 60_000),
  });
  const link = `${env.appUrl}/recenzije/nova-lozinka?token=${token}`;
  const res = await sendEmail(
    user.email,
    "Nova lozinka za NOVO Recenzije",
    `<p>Bok ${escapeHtml(user.name ?? "")},</p><p>Novu lozinku postavite na ovoj poveznici (vrijedi 1 sat):</p><p><a href="${link}">${link}</a></p><p>Ako niste tražili novu lozinku, slobodno zanemarite ovaj email.</p>`,
    `Nova lozinka (vrijedi 1 sat): ${link}`
  );
  if (!res.ok) return { values: echoValues(fd), error: res.error };
  return generic;
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await ensureReviewsDb();
  const tooMany = await limited("reset", 10, 15 * 60_000);
  if (tooMany) return { error: tooMany };
  const parsed = z
    .object({ token: z.string().min(20).max(200), password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Lozinke se ne podudaraju", path: ["confirm"] })
    .safeParse(formObject(fd));
  if (!parsed.success) return { fieldErrors: zodErrors(parsed.error) };

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, sha256(parsed.data.token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    )
    .limit(1);
  if (!row) return { error: "Poveznica nije ispravna ili je istekla. Zatražite novu." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.userId, row.userId));
  });
  redirect("/recenzije/prijava?reset=1");
}

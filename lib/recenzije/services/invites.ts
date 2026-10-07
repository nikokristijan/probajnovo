import "server-only";
import { and, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { generateInviteCode, isEnvInviteCode, normalizeInviteCode } from "@/lib/recenzije/crypto";
import { db } from "@/lib/recenzije/db";
import { ensureReviewsDb } from "@/lib/recenzije/db/ensure";
import { inviteCodes, type InviteCode } from "@/lib/recenzije/db/schema";
import { env } from "@/lib/recenzije/env";

/**
 * Pozivni kodovi za registraciju. Dva izvora: kodovi iz baze (jednokratni ili s ograničenim brojem
 * upotreba, s rokom, opozivi; njima upravlja glavni admin) i rezervni NR_INVITE_CODES iz okruženja.
 *
 * Provjera i potrošnja su odvojeni koraci: `isInviteCodeUsable` samo čita (da neispravan kod ne
 * otkrije postoji li email), a `consumeInviteCode` je jedan atomski UPDATE koji se zove tek kad je
 * sve ostalo u registraciji prošlo, u istoj transakciji kao upis korisnika. Ako upis padne, transakcija
 * se poništi i upotreba se sama vrati.
 */

/** Greška čiju poruku smijemo pokazati adminu; sve ostalo (npr. greške baze s upitom i parametrima) ne. */
export class InviteError extends Error {}

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type InviteStatus = "active" | "used" | "expired" | "revoked";
export type InviteConsumption = { source: "env" } | { source: "db"; id: string };

const LIST_LIMIT = 200;

/** Uvjet "kod se sada može iskoristiti". Sat je onaj baze, pa istek ne ovisi o satu aplikacije. */
function usableNow(code: string) {
  return and(
    eq(inviteCodes.code, code),
    lt(inviteCodes.uses, inviteCodes.maxUses),
    isNull(inviteCodes.revokedAt),
    or(isNull(inviteCodes.expiresAt), gt(inviteCodes.expiresAt, sql`now()`))
  );
}

export function inviteStatus(
  r: Pick<InviteCode, "uses" | "maxUses" | "revokedAt" | "expiresAt">,
  now = new Date()
): InviteStatus {
  if (r.revokedAt) return "revoked";
  if (r.uses >= r.maxUses) return "used";
  if (r.expiresAt && r.expiresAt <= now) return "expired";
  return "active";
}

/** Čita bez trošenja. Razlog odbijanja (nepoznat, istekao, opozvan, iskorišten) se nikad ne razlikuje. */
export async function isInviteCodeUsable(raw: string): Promise<boolean> {
  const fromEnv = isEnvInviteCode(raw); // uvijek se izračuna, neovisno o bazi
  const normalized = normalizeInviteCode(raw);
  let fromDb = false;
  if (normalized) {
    const [row] = await db.select({ id: inviteCodes.id }).from(inviteCodes).where(usableNow(normalized)).limit(1);
    fromDb = !!row;
  }
  return fromEnv || fromDb;
}

/**
 * Atomski troši jednu upotrebu: UPDATE ... WHERE uses < max_uses AND nije opozvan AND nije istekao
 * RETURNING. Dva istovremena zahtjeva za jednokratni kod ne mogu oba uspjeti (drugi čeka redak
 * i nakon commita više ne zadovoljava uvjet). Zovi unutar transakcije u kojoj nastaje korisnik.
 * Vraća null ako kod ne vrijedi (razlog se namjerno ne vraća).
 */
export async function consumeInviteCode(tx: DbTransaction, raw: string, usedBy: string): Promise<InviteConsumption | null> {
  const fromEnv = isEnvInviteCode(raw);
  const normalized = normalizeInviteCode(raw);
  if (normalized) {
    const [row] = await tx
      .update(inviteCodes)
      .set({ uses: sql`${inviteCodes.uses} + 1`, lastUsedBy: usedBy, lastUsedAt: sql`now()` })
      .where(usableNow(normalized))
      .returning({ id: inviteCodes.id });
    if (row) return { source: "db", id: row.id };
  }
  return fromEnv ? { source: "env" } : null;
}

// --- Upravljanje (samo glavni admin; pristup provjerava pozivatelj) ---

export type InviteRow = InviteCode & { status: InviteStatus };

export async function listInviteCodes(): Promise<InviteRow[]> {
  await ensureReviewsDb();
  const rows = await db.select().from(inviteCodes).orderBy(desc(inviteCodes.createdAt)).limit(LIST_LIMIT);
  const now = new Date();
  return rows.map((r) => ({ ...r, status: inviteStatus(r, now) }));
}

/** Koliko dodatnih kodova vrijedi iz okruženja (NR_INVITE_CODES). Same kodove nikad ne izlažemo. */
export function envInviteCodeCount() {
  return env.inviteCodes.length;
}

export async function createInviteCode(input: {
  label: string | null;
  maxUses: number;
  expiresInDays: number | null;
  createdBy: string;
}): Promise<InviteCode> {
  await ensureReviewsDb();
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null;
  // Sudar jedinstvenog koda je praktički nemoguć, ali se svejedno ponovi umjesto da pukne.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [row] = await db
      .insert(inviteCodes)
      .values({
        code: generateInviteCode(),
        label: input.label,
        maxUses: input.maxUses,
        expiresAt,
        createdBy: input.createdBy,
      })
      .onConflictDoNothing({ target: inviteCodes.code })
      .returning();
    if (row) return row;
  }
  throw new InviteError("Kod nije napravljen. Pokušajte ponovno.");
}

/** Opoziv je trajan: kod odmah prestaje vrijediti, a redak ostaje radi pregleda. */
export async function revokeInviteCode(id: string): Promise<InviteCode> {
  await ensureReviewsDb();
  const [row] = await db
    .update(inviteCodes)
    .set({ revokedAt: new Date() })
    .where(and(eq(inviteCodes.id, id), isNull(inviteCodes.revokedAt)))
    .returning();
  if (!row) throw new InviteError("Kod nije pronađen ili je već opozvan.");
  return row;
}

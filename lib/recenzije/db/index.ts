import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { nrPg?: ReturnType<typeof postgres> };

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL nije postavljen.");
}

// Ista baza kao ostatak probajnova, vlastiti mali pool (tablice imaju prefiks nr_).
const client = globalForDb.nrPg ?? postgres(process.env.DATABASE_URL, { max: 3, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.nrPg = client;

export const db = drizzle(client, { schema });
export { schema };

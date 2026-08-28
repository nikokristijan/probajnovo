import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
throw new Error(
"DATABASE_URL nije postavljen. Dodaj ga u .env (lokalno) ili u Environment Variables na hostingu."
);
}

// A small connection pool. `prepare: false` is required for connection
// poolers like Supabase's pgbouncer / Vercel's pooled Postgres URL.
const client = postgres(process.env.DATABASE_URL, { prepare: false, max: 10 });

export const db = drizzle(client, { schema });

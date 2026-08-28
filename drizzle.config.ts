import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";

// Load .env manually so `drizzle-kit` (a plain CLI, not Next.js) sees it.
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
const trimmed = line.trim();
if (!trimmed || trimmed.startsWith("#")) continue;
const eq = trimmed.indexOf("=");
if (eq === -1) continue;
const key = trimmed.slice(0, eq).trim();
const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
if (!process.env[key]) process.env[key] = value;
}
}

export default defineConfig({
schema: "./lib/db/schema.ts",
out: "./drizzle",
dialect: "postgresql",
dbCredentials: {
url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
  });

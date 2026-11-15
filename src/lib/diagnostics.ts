import "server-only";
import fs from "node:fs";
import path from "node:path";
import { databaseUrlFromEnv, pool } from "@/db";

export type HealthCode = "OK" | "NO_DATABASE_URL" | "DB_UNREACHABLE" | "MIGRATIONS_NOT_FOUND" | "MIGRATIONS_PENDING";
export type Health = { code: HealthCode; detail?: string; checks: { env: boolean; db: boolean; migrationsFolder: boolean; tables: boolean } };

export function migrationsFolder(): string | null {
  for (const p of [path.join(process.cwd(), "drizzle"), path.join(process.cwd(), ".next", "server", "drizzle")]) {
    if (fs.existsSync(path.join(p, "meta", "_journal.json"))) return p;
  }
  return null;
}

/** Live self-check (never returns secrets: only codes and the database error code/class). */
export async function checkHealth(): Promise<Health> {
  const checks = { env: !!databaseUrlFromEnv(), db: false, migrationsFolder: !!migrationsFolder(), tables: false };
  if (!checks.env) return { code: "NO_DATABASE_URL", checks };
  try {
    const r = await pool.query("select to_regclass('public.users') is not null as ok");
    checks.db = true;
    checks.tables = !!r.rows[0]?.ok;
  } catch (e) {
    const err = e as { code?: string; errno?: string };
    return { code: "DB_UNREACHABLE", detail: String(err.code ?? err.errno ?? "connect_error").slice(0, 40), checks };
  }
  if (!checks.tables) return { code: checks.migrationsFolder ? "MIGRATIONS_PENDING" : "MIGRATIONS_NOT_FOUND", checks };
  return { code: "OK", checks };
}

export async function isHealthy(): Promise<boolean> {
  try { return (await checkHealth()).code === "OK"; } catch { return false; }
}

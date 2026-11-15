import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { databaseUrlFromEnv, pool } from "@/db";
import { prepareSetupToken } from "@/lib/setup";
import { migrationsFolder } from "@/lib/diagnostics";

/** Applies pending DB migrations (serialised across instances). Returns true when the DB is ready. */
export async function runMigrations(): Promise<boolean> {
  if (!databaseUrlFromEnv()) { console.error("[db] DATABASE_URL is not set — open /status"); return false; }
  const folder = migrationsFolder();
  if (!folder) { console.error("[db] migrations folder not found — open /status"); return false; }
  const client = await pool.connect();
  try {
    // Several serverless instances may cold-start at once: only one migrates at a time.
    await client.query("select pg_advisory_lock(814200)");
    await migrate(drizzle(client), { migrationsFolder: folder });
    console.log("[db] migrations applied");
    return true;
  } finally {
    await client.query("select pg_advisory_unlock(814200)").catch(() => {});
    client.release();
  }
}

/**
 * Startup never throws: a misconfigured database must not take the whole site down with a bare
 * "Internal Server Error". Problems are logged and explained on /status instead.
 */
export async function runStartupTasks() {
  try {
    const ready = process.env.SKIP_DB_MIGRATIONS === "true" ? true : await runMigrations();
    if (ready) await prepareSetupToken();
  } catch (err) {
    console.error("[startup] database not ready — open /status for details:", err);
  }
}

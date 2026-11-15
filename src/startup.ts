import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pool } from "@/db";
import { prepareSetupToken } from "@/lib/setup";

/** Applies pending DB migrations (serialised across instances) and prepares the first-run setup token. */
export async function runStartupTasks() {
  if (process.env.SKIP_DB_MIGRATIONS !== "true") {
    const client = await pool.connect();
    try {
      // Several serverless instances may cold-start at once: only one migrates at a time.
      await client.query("select pg_advisory_lock(814200)");
      await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
      console.log("[db] migrations applied");
    } finally {
      await client.query("select pg_advisory_unlock(814200)").catch(() => {});
      client.release();
    }
  }
  await prepareSetupToken();
}

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

/** DATABASE_URL, or POSTGRES_URL as set by some Vercel storage integrations. */
export function databaseUrlFromEnv(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

/**
 * The pool is created lazily on first use, so `next build` works without DATABASE_URL
 * (e.g. on Vercel before a database is attached). At runtime a missing URL still fails loudly.
 */
function getPool(): Pool {
  if (globalForDb.__arenaNextJsPostgresqlPool) return globalForDb.__arenaNextJsPostgresqlPool;
  const databaseUrl = databaseUrlFromEnv();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const created = new Pool({
    connectionString: databaseUrl,
    max: process.env.VERCEL ? 3 : 10, // serverless: keep few connections per instance
    idleTimeoutMillis: 10_000,
  });
  globalForDb.__arenaNextJsPostgresqlPool = created;
  return created;
}

// Proxy keeps `pool instanceof Pool` true (drizzle relies on it for transactions).
export const pool: Pool = new Proxy(Object.create(Pool.prototype) as Pool, {
  get(_target, prop) {
    const real = getPool();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

type Db = ReturnType<typeof drizzle<Record<string, never>, Pool>>;
let realDb: Db | undefined;
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    realDb ??= drizzle(pool);
    const value = Reflect.get(realDb, prop, realDb);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});

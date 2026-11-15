import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { eq, inArray, count } from "drizzle-orm";
import { db } from "@/db";
import { users, platform_settings } from "@/db/schema";

export async function rootExists(): Promise<boolean> {
  const [{ value }] = await db.select({ value: count() }).from(users).where(inArray(users.role, ["root", "super_admin"]));
  return value > 0;
}

const sha = (s: string) => createHash("sha256").update(s).digest();

/**
 * One-time setup token protects the first-run wizard from being hijacked by whoever reaches
 * a fresh install first. Uses SETUP_TOKEN from the environment, or generates one and prints it
 * to the server log (like Jenkins / Grafana do).
 */
export async function prepareSetupToken() {
  if (await rootExists()) return;
  if (process.env.SETUP_TOKEN) {
    console.log("[setup] No root account yet. Open /setup and use the SETUP_TOKEN from your environment.");
    return;
  }
  // Serverless platforms start many instances: keep a recently generated token instead of replacing it.
  const [existing] = await db.select().from(platform_settings).where(eq(platform_settings.key, "setup_token_hash")).limit(1);
  if (existing && Date.now() - existing.updated_at.getTime() < 30 * 60_000) {
    console.log("[setup] A setup token was generated less than 30 minutes ago (see earlier log), or set SETUP_TOKEN.");
    return;
  }
  const token = randomBytes(9).toString("base64url");
  await db.insert(platform_settings).values({ key: "setup_token_hash", value: sha(token).toString("hex") })
    .onConflictDoUpdate({ target: platform_settings.key, set: { value: sha(token).toString("hex"), updated_at: new Date() } });
  console.log("\n==================================================================");
  console.log("  ARENA FIRST-RUN SETUP");
  console.log("  No root account exists yet. Open /setup in your browser");
  console.log(`  and enter this one-time setup token:  ${token}`);
  console.log("==================================================================\n");
}

export async function verifySetupToken(input: string): Promise<boolean> {
  const given = sha(input ?? "");
  let expected: Buffer | null = null;
  if (process.env.SETUP_TOKEN) expected = sha(process.env.SETUP_TOKEN);
  else {
    const [row] = await db.select().from(platform_settings).where(eq(platform_settings.key, "setup_token_hash")).limit(1);
    if (typeof row?.value === "string") expected = Buffer.from(row.value, "hex");
  }
  return !!expected && expected.length === given.length && timingSafeEqual(expected, given);
}

export async function demoSeeded(): Promise<boolean> {
  const [row] = await db.select().from(platform_settings).where(eq(platform_settings.key, "demo_seeded")).limit(1);
  return row?.value === true;
}

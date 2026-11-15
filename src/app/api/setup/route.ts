import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users, platform_settings } from "@/db/schema";
import { hashPassword, createSession, audit } from "@/lib/auth";
import { rootExists, verifySetupToken, demoSeeded } from "@/lib/setup";
import { seedDemo } from "@/lib/seed";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, emailSchema, passwordSchema, readJson } from "@/lib/security";
import { jsonError } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ needsSetup: !(await rootExists()), demo: await demoSeeded() });
}

const Body = z.object({
  token: z.string().min(1).max(200),
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  demo: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`setup:${ip}`, 10, 15 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) {
    const weak = parsed.error.issues.some((i) => i.path[0] === "password");
    return jsonError(weak ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  }
  if (!(await verifySetupToken(parsed.data.token))) return jsonError("BAD_SETUP_TOKEN", 403);

  const d = parsed.data;
  const hash = await hashPassword(d.password);
  // Serialize concurrent setup attempts with an advisory lock; only the first one can create root.
  const root = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(814201)`);
    const [{ n }] = (await tx.execute<{ n: number }>(sql`select count(*)::int as n from users where role in ('root','super_admin')`)).rows;
    if (n > 0) return null;
    const [u] = await tx.insert(users).values({ email: d.email, password_hash: hash, name: d.name, role: "root", permissions: ["*"], password_changed_at: new Date() }).returning();
    await tx.insert(platform_settings).values({ key: "setup_completed_at", value: new Date().toISOString() }).onConflictDoNothing();
    await tx.delete(platform_settings).where(sql`${platform_settings.key} = 'setup_token_hash'`);
    return u;
  });
  if (!root) return jsonError("SETUP_DONE", 409);

  await audit(root.id, null, "setup.root_created", "user", root.id, null, { email: root.email }, ip);
  let demoError = false;
  if (d.demo) {
    try { await seedDemo(); await audit(root.id, null, "setup.demo_seeded", "platform", undefined, null, null, ip); }
    catch (e) { console.error("[setup] demo seed failed", e); demoError = true; }
  }
  await createSession(root.id, ip, req.headers.get("user-agent") ?? undefined);
  return NextResponse.json({ ok: true, demoError });
}

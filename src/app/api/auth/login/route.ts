import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSession, audit, isPlatformAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, readJson } from "@/lib/security";
import { jsonError } from "@/lib/guard";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(200) });
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const ipLimit = rateLimit(`login:ip:${ip}`, 30, 15 * 60_000);
  if (!ipLimit.ok) return jsonError("RATE_LIMITED", 429, { retryAfter: ipLimit.retryAfter });
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_CREDENTIALS", 400);
  const { email, password } = parsed.data;
  if (!rateLimit(`login:email:${email}`, 10, 15 * 60_000).ok) return jsonError("RATE_LIMITED", 429);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Always run bcrypt so response time does not reveal whether the account exists.
  const valid = await verifyPassword(password, user?.password_hash);
  const locked = !!user?.locked_until && user.locked_until > new Date();

  if (!user || !valid || locked || !user.is_active) {
    if (user && !valid && !locked) {
      const fails = user.failed_login_count + 1;
      await db.update(users).set(fails >= MAX_FAILS ? { failed_login_count: 0, locked_until: new Date(Date.now() + LOCK_MS) } : { failed_login_count: fails }).where(eq(users.id, user.id));
      if (fails >= MAX_FAILS) await audit(user.id, user.tenant_id, "login.locked", "user", user.id, null, null, ip);
    }
    return jsonError("INVALID_CREDENTIALS", 401);
  }

  await db.update(users).set({ last_login_at: new Date(), failed_login_count: 0, locked_until: null }).where(eq(users.id, user.id));
  await createSession(user.id, ip, req.headers.get("user-agent") ?? undefined);
  await audit(user.id, user.tenant_id, "login", "user", user.id, null, null, ip);
  return NextResponse.json({ ok: true, redirect: isPlatformAdmin(user) ? "/root" : "/dashboard" });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, hashPassword, destroyAllSessions, destroySession, audit } from "@/lib/auth";
import { apiUser, jsonError } from "@/lib/guard";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, passwordSchema, readJson } from "@/lib/security";

export const dynamic = "force-dynamic";
const Body = z.object({ current: z.string().min(1).max(200), next: passwordSchema });

export async function POST(req: NextRequest) {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  if (!rateLimit(`pw:${user.id}`, 5, 15 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues.some((i) => i.path[0] === "next") ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  if (!(await verifyPassword(parsed.data.current, user.password_hash))) return jsonError("WRONG_PASSWORD", 400);
  await db.update(users).set({ password_hash: await hashPassword(parsed.data.next), password_changed_at: new Date() }).where(eq(users.id, user.id));
  await destroyAllSessions(user.id);
  await destroySession();
  await audit(user.id, user.tenant_id, "user.password_changed", "user", user.id, null, null, clientIp(req));
  return NextResponse.json({ ok: true });
}

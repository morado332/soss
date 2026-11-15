import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, sessions, audit_logs } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const COOKIE = "arena_session";

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function verifyPassword(pw: string, hash: string) { return bcrypt.compare(pw, hash); }
function tokenHash(t: string) { return createHash("sha256").update(t).digest("hex"); }

export async function createSession(userId: string, ip?: string, ua?: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await db.insert(sessions).values({ user_id: userId, token_hash: tokenHash(token), expires_at: expires, ip, user_agent: ua });
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires, secure: process.env.NODE_ENV === "production" });
  return token;
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token_hash, tokenHash(token)));
  c.delete(COOKIE);
}

export type CurrentUser = typeof users.$inferSelect;

export async function currentUser(): Promise<CurrentUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db.select({ user: users }).from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .where(and(eq(sessions.token_hash, tokenHash(token)), gt(sessions.expires_at, new Date())))
    .limit(1);
  const u = rows[0]?.user;
  if (!u || !u.is_active) return null;
  return u;
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

// Tenant isolation guard — Section 4. Root bypasses, everyone else is scoped.
export function assertTenantAccess(user: CurrentUser, tenantId: string | null | undefined) {
  if (user.role === "root" || user.role === "super_admin") return;
  if (!tenantId) throw new Error("TENANT_REQUIRED");
  if (user.tenant_id !== tenantId) throw new Error("FORBIDDEN_TENANT_MISMATCH");
}

export async function audit(actorId: string | null, tenantId: string | null, action: string, entity: string, entityId?: string, oldValue?: unknown, newValue?: unknown, ip?: string) {
  await db.insert(audit_logs).values({
    actor_id: actorId, tenant_id: tenantId, action, entity, entity_id: entityId,
    old_value: oldValue as never, new_value: newValue as never, ip,
  });
}

export function hasPermission(user: CurrentUser, perm: string): boolean {
  if (user.role === "root") return true;
  const perms = (user.permissions as string[] | null) ?? [];
  return perms.includes(perm) || perms.includes("*");
}

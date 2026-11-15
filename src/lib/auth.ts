import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users, sessions, audit_logs } from "@/db/schema";
import { eq, and, gt, lt } from "drizzle-orm";

export const COOKIE = "arena_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12h

// A valid bcrypt hash used to keep login timing constant for unknown e-mails.
const DUMMY_HASH = "$2b$12$/oEPKMkBEFO/Y4q3LkTkAezHzAW1ZV2FIBmv8V2c9V.8yvJU6Ob4q";

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12); }
export async function verifyPassword(pw: string, hash: string | null | undefined) {
  try { return await bcrypt.compare(pw, hash || DUMMY_HASH); } catch { return false; }
}
function tokenHash(t: string) { return createHash("sha256").update(t).digest("hex"); }

function cookieSecure() {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.VERCEL === "1" || (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
}

export async function createSession(userId: string, ip?: string, ua?: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await db.delete(sessions).where(lt(sessions.expires_at, new Date()));
  await db.insert(sessions).values({ user_id: userId, token_hash: tokenHash(token), expires_at: expires, ip, user_agent: ua?.slice(0, 300) });
  const c = await cookies();
  c.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", expires, secure: cookieSecure() });
}

export async function destroySession() {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token_hash, tokenHash(token)));
  c.delete(COOKIE);
}

/** Invalidate all sessions of a user (e.g. after password change), optionally keeping the current one. */
export async function destroyAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.user_id, userId));
}

export type CurrentUser = typeof users.$inferSelect;

export async function currentUser(): Promise<CurrentUser | null> {
  const c = await cookies();
  const token = c.get(COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const rows = await db.select({ user: users }).from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .where(and(eq(sessions.token_hash, tokenHash(token)), gt(sessions.expires_at, new Date())))
    .limit(1);
  const u = rows[0]?.user;
  if (!u || !u.is_active) return null;
  return u;
}

export function isPlatformAdmin(user: Pick<CurrentUser, "role">) {
  return user.role === "root" || user.role === "super_admin";
}

export function hasPermission(user: CurrentUser, perm: string): boolean {
  if (isPlatformAdmin(user) || user.role === "tenant_owner") return true;
  const perms = (user.permissions as string[] | null) ?? [];
  return perms.includes(perm) || perms.includes("*");
}

export async function audit(actorId: string | null, tenantId: string | null, action: string, entity: string, entityId?: string, oldValue?: unknown, newValue?: unknown, ip?: string) {
  await db.insert(audit_logs).values({
    actor_id: actorId, tenant_id: tenantId, action, entity, entity_id: entityId,
    old_value: (oldValue ?? null) as never, new_value: (newValue ?? null) as never, ip,
  });
}

/** Never leak password hashes or lockout internals to clients or audit logs. */
export function publicUser(u: CurrentUser) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, tenant_id: u.tenant_id, accountant_id: u.accountant_id, permissions: u.permissions, is_active: u.is_active, last_login_at: u.last_login_at, created_at: u.created_at };
}

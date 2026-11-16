import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { audit, hashPassword, destroyAllSessions } from "@/lib/auth";
import { apiRoot, jsonError } from "@/lib/guard";
import { clientIp, emailSchema, passwordSchema, readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

// All people on the platform (owners, staff, accountants). Root & platform staff accounts are managed under /root/team.
export async function GET(req: NextRequest) {
  const user = await apiRoot("platform:tenants");
  if (user instanceof NextResponse) return user;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const conds = [ne(users.role, "root"), ne(users.role, "super_admin")];
  if (q) conds.push(or(ilike(users.email, `%${q.replace(/[%_\\]/g, "\\$&")}%`), ilike(users.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`))!);
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role, is_active: users.is_active, last_login_at: users.last_login_at,
    accountant_id: users.accountant_id, locked: sql<boolean>`coalesce(${users.locked_until} > now(), false)`, tenant: tenants.name, tenant_id: users.tenant_id,
  }).from(users).leftJoin(tenants, eq(users.tenant_id, tenants.id)).where(and(...conds)).orderBy(desc(users.created_at)).limit(300);
  return NextResponse.json(rows);
}

const Patch = z.object({
  id: z.string().uuid(), name: z.string().trim().min(2).max(120).optional(), email: emailSchema.optional(),
  password: passwordSchema.optional(), is_active: z.boolean().optional(), unlock: z.boolean().optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const user = await apiRoot("platform:tenants");
  if (user instanceof NextResponse) return user;
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues.some((i) => i.path[0] === "password") ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  const { id, password, unlock, ...rest } = parsed.data;
  // Platform accounts can't be edited here (prevents a Super Admin from taking over the Root).
  const where = and(eq(users.id, id), ne(users.role, "root"), ne(users.role, "super_admin"));
  const [old] = await db.select({ email: users.email, name: users.name, is_active: users.is_active, tenant_id: users.tenant_id }).from(users).where(where).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  if (rest.email && rest.email !== old.email) {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, rest.email)).limit(1);
    if (taken) return jsonError("EMAIL_TAKEN", 409);
  }
  const patch: Record<string, unknown> = { ...rest };
  if (password) { patch.password_hash = await hashPassword(password); patch.password_changed_at = new Date(); }
  if (password || unlock) { patch.failed_login_count = 0; patch.locked_until = null; }
  if (Object.keys(patch).length) await db.update(users).set(patch).where(where);
  if (password || rest.email || rest.is_active === false) await destroyAllSessions(id);
  await audit(user.id, old.tenant_id, "user.admin_update", "user", id, { email: old.email, name: old.name, is_active: old.is_active }, { ...rest, password: password ? "changed" : undefined, unlock }, clientIp(req));
  return NextResponse.json({ ok: true });
}

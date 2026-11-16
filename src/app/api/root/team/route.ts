import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, profiles } from "@/db/schema";
import { audit, hashPassword, destroyAllSessions } from "@/lib/auth";
import { apiRoot, jsonError } from "@/lib/guard";
import { PLATFORM_PERMISSIONS } from "@/lib/permissions";
import { clientIp, emailSchema, passwordSchema, readJson } from "@/lib/security";

export const dynamic = "force-dynamic";
const perms = z.array(z.enum(PLATFORM_PERMISSIONS)).max(PLATFORM_PERMISSIONS.length);

// Super Admin management — Root only.
export async function GET() {
  const user = await apiRoot("root");
  if (user instanceof NextResponse) return user;
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, permissions: users.permissions, is_active: users.is_active, last_login_at: users.last_login_at, created_at: users.created_at })
    .from(users).where(eq(users.role, "super_admin")).orderBy(desc(users.created_at));
  return NextResponse.json(rows.filter((r) => !r.email.endsWith("@deleted.invalid")));
}

const Create = z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema, permissions: perms }).strict();

export async function POST(req: NextRequest) {
  const user = await apiRoot("root");
  if (user instanceof NextResponse) return user;
  const parsed = Create.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues.some((i) => i.path[0] === "password") ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  const d = parsed.data;
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (taken) return jsonError("EMAIL_TAKEN", 409);
  const [u] = await db.insert(users).values({ email: d.email, name: d.name, password_hash: await hashPassword(d.password), role: "super_admin", permissions: d.permissions, password_changed_at: new Date() }).returning({ id: users.id });
  await audit(user.id, null, "platform.staff.create", "user", u.id, null, { email: d.email, permissions: d.permissions }, clientIp(req));
  return NextResponse.json({ ok: true });
}

const Patch = z.object({
  id: z.string().uuid(), name: z.string().trim().min(2).max(120).optional(), email: emailSchema.optional(),
  password: passwordSchema.optional(), permissions: perms.optional(), is_active: z.boolean().optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const user = await apiRoot("root");
  if (user instanceof NextResponse) return user;
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues.some((i) => i.path[0] === "password") ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  const { id, password, ...rest } = parsed.data;
  const where = and(eq(users.id, id), eq(users.role, "super_admin"));
  const [old] = await db.select({ email: users.email, permissions: users.permissions, is_active: users.is_active }).from(users).where(where).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  if (rest.email && rest.email !== old.email) {
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, rest.email)).limit(1);
    if (taken) return jsonError("EMAIL_TAKEN", 409);
  }
  const patch: Record<string, unknown> = { ...rest };
  if (password) { patch.password_hash = await hashPassword(password); patch.password_changed_at = new Date(); patch.failed_login_count = 0; patch.locked_until = null; }
  await db.update(users).set(patch).where(where);
  // Any change to credentials, rights or status signs the person out everywhere.
  if (password || rest.email || rest.permissions || rest.is_active === false) await destroyAllSessions(id);
  await audit(user.id, null, "platform.staff.update", "user", id, old, { ...rest, password: password ? "changed" : undefined }, clientIp(req));
  return NextResponse.json({ ok: true });
}

// Delete = deactivate + anonymise (the account stays referenced by the audit log, GoBD).
export async function DELETE(req: NextRequest) {
  const user = await apiRoot("root");
  if (user instanceof NextResponse) return user;
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return jsonError("INVALID_INPUT", 400);
  const where = and(eq(users.id, id.data), eq(users.role, "super_admin"));
  const [old] = await db.select({ email: users.email }).from(users).where(where).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  await db.update(users).set({ is_active: false, permissions: [], name: "—", email: `${id.data}@deleted.invalid`, password_hash: "!" }).where(where);
  await db.delete(profiles).where(eq(profiles.user_id, id.data));
  await destroyAllSessions(id.data);
  await audit(user.id, null, "platform.staff.delete", "user", id.data, { email: old.email }, null, clientIp(req));
  return NextResponse.json({ ok: true });
}

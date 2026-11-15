import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit, hashPassword, destroyAllSessions } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { STAFF_PRESETS } from "@/lib/permissions";
import { clientIp, emailSchema, passwordSchema, readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant(undefined, { ownerOnly: true });
  if (ctx instanceof NextResponse) return ctx;
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, permissions: users.permissions, is_active: users.is_active, last_login_at: users.last_login_at })
    .from(users).where(eq(users.tenant_id, ctx.tenant.id)).orderBy(asc(users.created_at));
  return NextResponse.json(rows);
}

const presetSchema = z.enum(["cashier", "reception", "manager"]);
const Body = z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema, preset: presetSchema }).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiTenant(undefined, { ownerOnly: true, write: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues.some((i) => i.path[0] === "password") ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  const d = parsed.data;
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (exists) return jsonError("EMAIL_TAKEN", 409);
  const [u] = await db.insert(users).values({
    email: d.email, name: d.name, password_hash: await hashPassword(d.password), role: "tenant_staff", tenant_id: ctx.tenant.id, permissions: STAFF_PRESETS[d.preset],
  }).returning({ id: users.id, email: users.email });
  await audit(ctx.user.id, ctx.tenant.id, "staff.create", "user", u.id, null, { email: u.email, preset: d.preset }, clientIp(req));
  return NextResponse.json({ ok: true });
}

const Patch = z.object({ id: z.string().uuid(), is_active: z.boolean().optional(), preset: presetSchema.optional() }).strict();

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant(undefined, { ownerOnly: true, write: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const where = and(eq(users.id, parsed.data.id), eq(users.tenant_id, ctx.tenant.id), eq(users.role, "tenant_staff"));
  const [target] = await db.select({ id: users.id }).from(users).where(where).limit(1);
  if (!target) return jsonError("NOT_FOUND", 404);
  const patch: Record<string, unknown> = {};
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;
  if (parsed.data.preset) patch.permissions = STAFF_PRESETS[parsed.data.preset];
  await db.update(users).set(patch).where(where);
  if (parsed.data.is_active === false || parsed.data.preset) await destroyAllSessions(target.id);
  await audit(ctx.user.id, ctx.tenant.id, "staff.update", "user", target.id, null, parsed.data, clientIp(req));
  return NextResponse.json({ ok: true });
}

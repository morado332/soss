import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { fs_instructors } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant("appointments:read", { module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const now = new Date(); const day = now.getDay() || 7;
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(now.getDate() - day + 1);
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const rows = await db.select({
    id: fs_instructors.id, name: fs_instructors.name, email: fs_instructors.email, phone: fs_instructors.phone,
    license_classes: fs_instructors.license_classes, is_active: fs_instructors.is_active,
    week_units: sql<number>`coalesce((select sum(l.units) from fs_lessons l where l.instructor_id = "fs_instructors"."id" and l.tenant_id = ${ctx.tenant.id} and l.status <> 'cancelled' and l.starts_at >= ${weekStart} and l.starts_at < ${weekEnd}),0)::int`,
  }).from(fs_instructors).where(eq(fs_instructors.tenant_id, ctx.tenant.id)).orderBy(asc(fs_instructors.name));
  return NextResponse.json(rows);
}

const Fields = {
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(40).regex(/^[0-9+()\/\-\s]*$/).optional(),
  license_classes: z.string().trim().max(60).regex(/^[A-Za-z0-9, ]*$/).optional(),
};

export async function POST(req: NextRequest) {
  const ctx = await apiTenant("fahrschule:manage", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object(Fields).strict().safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const [row] = await db.insert(fs_instructors).values({ ...parsed.data, license_classes: parsed.data.license_classes || "B", tenant_id: ctx.tenant.id }).returning();
  await audit(ctx.user.id, ctx.tenant.id, "fs.instructor.create", "fs_instructor", row.id);
  return NextResponse.json({ ok: true, instructor: row });
}

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("fahrschule:manage", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const P = z.object({ id: z.string().uuid(), is_active: z.boolean().optional(), name: Fields.name.optional(), email: Fields.email, phone: Fields.phone, license_classes: Fields.license_classes }).strict();
  const parsed = P.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const { id, ...patch } = parsed.data;
  const [row] = await db.update(fs_instructors).set(patch).where(and(eq(fs_instructors.id, id), eq(fs_instructors.tenant_id, ctx.tenant.id))).returning({ id: fs_instructors.id });
  if (!row) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, "fs.instructor.update", "fs_instructor", id, null, patch);
  return NextResponse.json({ ok: true });
}

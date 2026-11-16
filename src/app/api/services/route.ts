import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { services } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { centsSchema, readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant();
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(await db.select().from(services).where(and(eq(services.tenant_id, ctx.tenant.id), eq(services.is_active, true))).orderBy(asc(services.name)));
}

const Body = z.object({ name: z.string().trim().min(1).max(200), duration_minutes: z.number().int().min(5).max(480), price_cents: centsSchema }).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiTenant("appointments:write", { write: true, module: "appointments" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const [row] = await db.insert(services).values({ ...parsed.data, tenant_id: ctx.tenant.id }).returning();
  await audit(ctx.user.id, ctx.tenant.id, "service.create", "service", row.id, null, parsed.data);
  return NextResponse.json({ ok: true, service: row });
}

export async function DELETE(req: NextRequest) {
  const ctx = await apiTenant("appointments:write", { write: true, module: "appointments" });
  if (ctx instanceof NextResponse) return ctx;
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return jsonError("INVALID_INPUT", 400);
  // Soft delete: keeps historical appointments intact
  const [row] = await db.update(services).set({ is_active: false }).where(and(eq(services.id, id.data), eq(services.tenant_id, ctx.tenant.id))).returning();
  if (!row) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, "service.deactivate", "service", row.id);
  return NextResponse.json({ ok: true });
}

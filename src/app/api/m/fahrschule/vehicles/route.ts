import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { fs_vehicles } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant("appointments:read", { module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(await db.select().from(fs_vehicles).where(eq(fs_vehicles.tenant_id, ctx.tenant.id)).orderBy(asc(fs_vehicles.name)));
}

const Fields = {
  name: z.string().trim().min(2).max(120),
  plate: z.string().trim().min(2).max(20).regex(/^[A-Za-zÄÖÜäöü0-9 \-]+$/),
  license_class: z.string().trim().max(10).regex(/^[A-Za-z0-9]*$/).optional(),
  transmission: z.enum(["manual", "automatic"]).optional(),
  next_service: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("").transform(() => undefined)),
};

export async function POST(req: NextRequest) {
  const ctx = await apiTenant("fahrschule:manage", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object(Fields).strict().safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const d = parsed.data;
  const [row] = await db.insert(fs_vehicles).values({ ...d, plate: d.plate.toUpperCase(), license_class: d.license_class || "B", tenant_id: ctx.tenant.id }).returning();
  await audit(ctx.user.id, ctx.tenant.id, "fs.vehicle.create", "fs_vehicle", row.id);
  return NextResponse.json({ ok: true, vehicle: row });
}

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("fahrschule:manage", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const P = z.object({ id: z.string().uuid(), is_active: z.boolean().optional(), next_service: Fields.next_service, transmission: Fields.transmission }).strict();
  const parsed = P.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const { id, ...patch } = parsed.data;
  const [row] = await db.update(fs_vehicles).set({ ...patch, next_service: patch.next_service ?? undefined }).where(and(eq(fs_vehicles.id, id), eq(fs_vehicles.tenant_id, ctx.tenant.id))).returning({ id: fs_vehicles.id });
  if (!row) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, "fs.vehicle.update", "fs_vehicle", id, null, patch);
  return NextResponse.json({ ok: true });
}

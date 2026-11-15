import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, services, notifications } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { hasConflict } from "@/lib/appointments";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant("appointments:read");
  if (ctx instanceof NextResponse) return ctx;
  const rows = await db.select({
    id: appointments.id, customer_name: appointments.customer_name, customer_email: appointments.customer_email, customer_phone: appointments.customer_phone,
    starts_at: appointments.starts_at, ends_at: appointments.ends_at, status: appointments.status, source: appointments.source, notes: appointments.notes,
    service_name: services.name,
  }).from(appointments).leftJoin(services, eq(appointments.service_id, services.id))
    .where(eq(appointments.tenant_id, ctx.tenant.id)).orderBy(desc(appointments.starts_at)).limit(200);
  return NextResponse.json(rows);
}

const Body = z.object({
  customer_name: z.string().trim().min(1).max(200),
  customer_email: z.string().trim().email().max(254).optional().or(z.literal("").transform(() => undefined)),
  customer_phone: z.string().trim().max(50).optional(),
  service_id: z.string().uuid().optional(),
  starts_at: z.string().datetime({ offset: true }),
  duration_minutes: z.number().int().min(5).max(480).default(30),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiTenant("appointments:write", { write: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const d = parsed.data;
  const tid = ctx.tenant.id;
  let duration = d.duration_minutes;
  if (d.service_id) {
    const [svc] = await db.select().from(services).where(and(eq(services.id, d.service_id), eq(services.tenant_id, tid))).limit(1);
    if (!svc) return jsonError("NOT_FOUND", 404);
    duration = svc.duration_minutes;
  }
  const starts = new Date(d.starts_at);
  const ends = new Date(starts.getTime() + duration * 60000);
  const row = await db.transaction(async (tx) => {
    if (await hasConflict(tx, tid, starts, ends)) return null;
    const [r] = await tx.insert(appointments).values({
      tenant_id: tid, customer_name: d.customer_name, customer_email: d.customer_email, customer_phone: d.customer_phone,
      service_id: d.service_id, starts_at: starts, ends_at: ends, notes: d.notes, source: "dashboard", status: "scheduled",
    }).returning();
    return r;
  });
  if (!row) return jsonError("CONFLICT", 409);
  await audit(ctx.user.id, tid, "appointment.create", "appointment", row.id, null, { starts_at: row.starts_at });
  return NextResponse.json({ ok: true, appointment: row });
}

const Patch = z.object({ id: z.string().uuid(), status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]) }).strict();

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("appointments:write", { write: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const where = and(eq(appointments.id, parsed.data.id), eq(appointments.tenant_id, ctx.tenant.id));
  const [old] = await db.select({ status: appointments.status }).from(appointments).where(where).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  await db.update(appointments).set({ status: parsed.data.status }).where(where);
  if (parsed.data.status === "cancelled") await db.insert(notifications).values({ tenant_id: ctx.tenant.id, title: "Termin abgesagt", type: "booking" });
  await audit(ctx.user.id, ctx.tenant.id, "appointment.status", "appointment", parsed.data.id, old, { status: parsed.data.status });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { fs_lessons, fs_students, fs_instructors, fs_vehicles } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { centsSchema, readJson } from "@/lib/security";
import { LESSON_TYPES, UNIT_MINUTES, lessonConflict } from "@/modules/fahrschule/service";

export const dynamic = "force-dynamic";

// GET ?from=ISO&to=ISO  (defaults: today)
export async function GET(req: NextRequest) {
  const ctx = await apiTenant("appointments:read", { module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const tid = ctx.tenant.id;
  const q = z.object({ from: z.string().datetime({ offset: true }).optional(), to: z.string().datetime({ offset: true }).optional() }).safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return jsonError("INVALID_INPUT", 400);
  const from = q.data.from ? new Date(q.data.from) : new Date(new Date().setHours(0, 0, 0, 0));
  const to = q.data.to ? new Date(q.data.to) : new Date(from.getTime() + 86_400_000);
  if (to.getTime() - from.getTime() > 62 * 86_400_000) return jsonError("INVALID_INPUT", 400);
  const rows = await db.select({
    id: fs_lessons.id, type: fs_lessons.type, starts_at: fs_lessons.starts_at, ends_at: fs_lessons.ends_at, units: fs_lessons.units,
    status: fs_lessons.status, price_cents: fs_lessons.price_cents, invoice_id: fs_lessons.invoice_id, notes: fs_lessons.notes,
    student_id: fs_lessons.student_id, student: fs_students.name, instructor_id: fs_lessons.instructor_id, instructor: fs_instructors.name,
    vehicle: fs_vehicles.name, plate: fs_vehicles.plate,
  }).from(fs_lessons)
    .innerJoin(fs_students, and(eq(fs_lessons.student_id, fs_students.id), eq(fs_students.tenant_id, tid)))
    .innerJoin(fs_instructors, and(eq(fs_lessons.instructor_id, fs_instructors.id), eq(fs_instructors.tenant_id, tid)))
    .leftJoin(fs_vehicles, and(eq(fs_lessons.vehicle_id, fs_vehicles.id), eq(fs_vehicles.tenant_id, tid)))
    .where(and(eq(fs_lessons.tenant_id, tid), gte(fs_lessons.starts_at, from), lt(fs_lessons.starts_at, to)))
    .orderBy(asc(fs_lessons.starts_at)).limit(500);
  return NextResponse.json(rows);
}

const Body = z.object({
  student_id: z.string().uuid(), instructor_id: z.string().uuid(),
  vehicle_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  type: z.enum(LESSON_TYPES), units: z.number().int().min(1).max(4),
  starts_at: z.string().datetime({ offset: true }), price_cents: centsSchema.max(100_000).default(0),
  notes: z.string().trim().max(1000).optional(),
}).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiTenant("appointments:write", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const d = parsed.data; const tid = ctx.tenant.id;
  // Every referenced record must belong to this business (IDOR protection).
  const own = async (table: typeof fs_students | typeof fs_instructors | typeof fs_vehicles, id: string) =>
    (await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.tenant_id, tid))).limit(1)).length > 0;
  if (!(await own(fs_students, d.student_id)) || !(await own(fs_instructors, d.instructor_id)) || (d.vehicle_id && !(await own(fs_vehicles, d.vehicle_id)))) return jsonError("NOT_FOUND", 404);
  const starts = new Date(d.starts_at);
  const ends = new Date(starts.getTime() + d.units * UNIT_MINUTES * 60_000);
  const out = await db.transaction(async (tx) => {
    const c = await lessonConflict(tx, tid, { starts, ends, instructor_id: d.instructor_id, vehicle_id: d.vehicle_id, student_id: d.student_id });
    if (c) return c;
    const [row] = await tx.insert(fs_lessons).values({ ...d, vehicle_id: d.vehicle_id ?? null, tenant_id: tid, starts_at: starts, ends_at: ends }).returning();
    return row;
  });
  if (typeof out === "string") return jsonError(out, 409);
  await audit(ctx.user.id, tid, "fs.lesson.create", "fs_lesson", out.id, null, { starts_at: out.starts_at, type: out.type });
  return NextResponse.json({ ok: true, lesson: out });
}

const Patch = z.object({ id: z.string().uuid(), status: z.enum(["scheduled", "completed", "cancelled", "no_show"]) }).strict();

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("appointments:write", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const where = and(eq(fs_lessons.id, parsed.data.id), eq(fs_lessons.tenant_id, ctx.tenant.id));
  const [old] = await db.select({ status: fs_lessons.status, invoice_id: fs_lessons.invoice_id }).from(fs_lessons).where(where).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  if (old.invoice_id) return jsonError("ALREADY_INVOICED", 409); // GoBD: invoiced lessons are final
  await db.update(fs_lessons).set({ status: parsed.data.status }).where(where);
  await audit(ctx.user.id, ctx.tenant.id, "fs.lesson.status", "fs_lesson", parsed.data.id, old, parsed.data);
  return NextResponse.json({ ok: true });
}

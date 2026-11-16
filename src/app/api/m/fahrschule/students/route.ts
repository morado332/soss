import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { fs_students, fs_instructors, fs_lessons } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

const done = (type: string) => sql<number>`coalesce(sum(${fs_lessons.units}) filter (where ${fs_lessons.status} = 'completed' and ${fs_lessons.type} = ${type}),0)::int`;

export async function GET(req: NextRequest) {
  const ctx = await apiTenant("appointments:read", { module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const tid = ctx.tenant.id;
  const id = req.nextUrl.searchParams.get("id");
  const counts = await db.select({
    student_id: fs_lessons.student_id,
    normal: done("normal"), ueberland: done("ueberland"), autobahn: done("autobahn"), nacht: done("nacht"), exam: done("exam"),
    planned: sql<number>`coalesce(sum(${fs_lessons.units}) filter (where ${fs_lessons.status} = 'scheduled'),0)::int`,
    unbilled: sql<number>`count(*) filter (where ${fs_lessons.status} = 'completed' and ${fs_lessons.invoice_id} is null and ${fs_lessons.price_cents} > 0)::int`,
  }).from(fs_lessons).where(eq(fs_lessons.tenant_id, tid)).groupBy(fs_lessons.student_id);
  const byStudent = new Map(counts.map((c) => [c.student_id, c]));
  const where = id ? and(eq(fs_students.tenant_id, tid), eq(fs_students.id, id)) : eq(fs_students.tenant_id, tid);
  if (id && !z.string().uuid().safeParse(id).success) return jsonError("INVALID_INPUT", 400);
  const rows = await db.select({ s: fs_students, instructor: fs_instructors.name }).from(fs_students)
    .leftJoin(fs_instructors, and(eq(fs_students.instructor_id, fs_instructors.id), eq(fs_instructors.tenant_id, tid)))
    .where(where).orderBy(asc(fs_students.name));
  const list = rows.map(({ s, instructor }) => ({ ...s, instructor, done: byStudent.get(s.id) ?? { normal: 0, ueberland: 0, autobahn: 0, nacht: 0, exam: 0, planned: 0, unbilled: 0 } }));
  if (!id) return NextResponse.json(list);
  if (!list[0]) return jsonError("NOT_FOUND", 404);
  const lessons = await db.select().from(fs_lessons).where(and(eq(fs_lessons.tenant_id, tid), eq(fs_lessons.student_id, id))).orderBy(desc(fs_lessons.starts_at)).limit(200);
  return NextResponse.json({ student: list[0], lessons });
}

const req = z.number().int().min(0).max(200);
const Fields = {
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().max(40).regex(/^[0-9+()\/\-\s]*$/).optional(),
  license_class: z.string().trim().max(10).regex(/^[A-Za-z0-9]*$/).optional(),
  instructor_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  req_normal: req.optional(), req_ueberland: req.optional(), req_autobahn: req.optional(), req_nacht: req.optional(),
  theory_external_id: z.string().trim().max(100).regex(/^[A-Za-z0-9_.\-]*$/).optional(),
  notes: z.string().trim().max(2000).optional(),
};

async function instructorOk(tid: string, id?: string | null) {
  if (!id) return true;
  return (await db.select({ id: fs_instructors.id }).from(fs_instructors).where(and(eq(fs_instructors.id, id), eq(fs_instructors.tenant_id, tid))).limit(1)).length > 0;
}

export async function POST(r: NextRequest) {
  const ctx = await apiTenant("fahrschule:manage", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object(Fields).strict().safeParse(await readJson(r));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  if (!(await instructorOk(ctx.tenant.id, parsed.data.instructor_id))) return jsonError("NOT_FOUND", 404);
  const [row] = await db.insert(fs_students).values({ ...parsed.data, license_class: parsed.data.license_class || "B", tenant_id: ctx.tenant.id }).returning();
  await audit(ctx.user.id, ctx.tenant.id, "fs.student.create", "fs_student", row.id);
  return NextResponse.json({ ok: true, student: row });
}

export async function PATCH(r: NextRequest) {
  const ctx = await apiTenant("fahrschule:manage", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const P = z.object({
    id: z.string().uuid(), ...Object.fromEntries(Object.entries(Fields).map(([k, v]) => [k, v.optional()])),
    status: z.enum(["active", "paused", "finished"]).optional(),
    theory_progress: z.number().int().min(0).max(100).optional(),
    theory_passed: z.boolean().optional(), practical_passed: z.boolean().optional(),
  }).strict();
  const parsed = P.safeParse(await readJson(r));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const { id, ...patch } = parsed.data as { id: string; instructor_id?: string } & Record<string, unknown>;
  if (!(await instructorOk(ctx.tenant.id, patch.instructor_id as string | undefined))) return jsonError("NOT_FOUND", 404);
  const [row] = await db.update(fs_students).set(patch).where(and(eq(fs_students.id, id), eq(fs_students.tenant_id, ctx.tenant.id))).returning({ id: fs_students.id });
  if (!row) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, "fs.student.update", "fs_student", id, null, patch);
  return NextResponse.json({ ok: true });
}

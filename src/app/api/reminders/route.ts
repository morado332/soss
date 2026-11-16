import { NextResponse } from "next/server";
import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { appointments, fs_lessons, fs_students } from "@/db/schema";
import { apiTenant, jsonError } from "@/lib/guard";
import { processReminders } from "@/core/reminders";
import { emailEnabled } from "@/core/notify";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant("appointments:read", { module: "reminders" });
  if (ctx instanceof NextResponse) return ctx;
  const tid = ctx.tenant.id;
  const now = new Date(), until = new Date(Date.now() + 48 * 3600_000);
  const appts = await db.select({ id: appointments.id, name: appointments.customer_name, email: appointments.customer_email, starts_at: appointments.starts_at, r24: appointments.reminded_24h_at, r1: appointments.reminded_1h_at })
    .from(appointments).where(and(eq(appointments.tenant_id, tid), gt(appointments.starts_at, now), lte(appointments.starts_at, until), inArray(appointments.status, ["scheduled", "confirmed"])))
    .orderBy(asc(appointments.starts_at)).limit(200);
  const lessons = await db.select({ id: fs_lessons.id, name: fs_students.name, email: fs_students.email, starts_at: fs_lessons.starts_at, r24: fs_lessons.reminded_24h_at, r1: fs_lessons.reminded_1h_at })
    .from(fs_lessons).innerJoin(fs_students, and(eq(fs_lessons.student_id, fs_students.id), eq(fs_students.tenant_id, tid)))
    .where(and(eq(fs_lessons.tenant_id, tid), gt(fs_lessons.starts_at, now), lte(fs_lessons.starts_at, until), eq(fs_lessons.status, "scheduled")))
    .orderBy(asc(fs_lessons.starts_at)).limit(200);
  const items = [...appts.map((a) => ({ ...a, kind: "appointment" })), ...lessons.map((l) => ({ ...l, kind: "lesson" }))]
    .sort((a, b) => +a.starts_at - +b.starts_at);
  return NextResponse.json({ email: emailEnabled(), items });
}

export async function POST() {
  const ctx = await apiTenant("appointments:write", { write: true, module: "reminders" });
  if (ctx instanceof NextResponse) return ctx;
  if (!rateLimit(`rem:${ctx.tenant.id}`, 6, 10 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const processed = await processReminders(ctx.tenant.id);
  return NextResponse.json({ ok: true, processed });
}

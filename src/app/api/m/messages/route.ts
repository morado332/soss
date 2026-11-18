import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { biz_records, users } from "@/db/schema";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { rateLimit } from "@/lib/ratelimit";
import { apiBiz } from "@/modules/business/access";

export const dynamic = "force-dynamic";
const MODS = ["messages"];

// Internal team messages: to one colleague or to everyone in the business. Each user only sees own conversations.
export async function GET() {
  const ctx = await apiBiz(undefined, MODS);
  if (ctx instanceof NextResponse) return ctx;
  const me = ctx.user.id;
  const rows = await db.select({ id: biz_records.id, data: biz_records.data, created_at: biz_records.created_at }).from(biz_records)
    .where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "messages"),
      or(sql`${biz_records.data}->>'to' is null`, sql`${biz_records.data}->>'to' = ${me}`, sql`${biz_records.data}->>'from' = ${me}`)))
    .orderBy(desc(biz_records.created_at)).limit(300);
  const staff = await db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.tenant_id, ctx.tenant.id), eq(users.is_active, true)));
  return NextResponse.json({ me, rows, staff: staff.filter((s) => s.id !== me) });
}

const Body = z.object({ to: z.string().uuid().nullable(), body: z.string().trim().min(1).max(2000) }).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiBiz(undefined, MODS, true);
  if (ctx instanceof NextResponse) return ctx;
  if (!rateLimit(`msg:${ctx.user.id}`, 60, 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const p = Body.safeParse(await readJson(req));
  if (!p.success) return jsonError("INVALID_INPUT", 400);
  if (p.data.to) {
    const [u] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, p.data.to), eq(users.tenant_id, ctx.tenant.id))).limit(1);
    if (!u) return jsonError("NOT_FOUND", 404);
  }
  await db.insert(biz_records).values({ tenant_id: ctx.tenant.id, kind: "messages", created_by: ctx.user.id,
    data: { from: ctx.user.id, from_name: ctx.user.name, to: p.data.to, body: p.data.body, read_by: [ctx.user.id] }, search: p.data.body.toLowerCase().slice(0, 500) });
  return NextResponse.json({ ok: true });
}

// mark everything visible to me as read
export async function PATCH() {
  const ctx = await apiBiz(undefined, MODS);
  if (ctx instanceof NextResponse) return ctx;
  const me = ctx.user.id;
  await db.update(biz_records).set({ data: sql`jsonb_set(${biz_records.data}, '{read_by}', coalesce(${biz_records.data}->'read_by', '[]'::jsonb) || to_jsonb(${me}::text))` })
    .where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "messages"), or(sql`${biz_records.data}->>'to' is null`, sql`${biz_records.data}->>'to' = ${me}`),
      sql`not coalesce(${biz_records.data}->'read_by', '[]'::jsonb) ? ${me}`));
  return NextResponse.json({ ok: true });
}

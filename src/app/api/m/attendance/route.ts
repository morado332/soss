import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { biz_records } from "@/db/schema";
import { audit, hasPermission } from "@/lib/auth";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { apiBiz } from "@/modules/business/access";

export const dynamic = "force-dynamic";
const MODS = ["attendance"];

// Clock in / out. Everyone sees their own times; owners and managers (biz:write) see the whole team.
export async function GET(req: NextRequest) {
  const ctx = await apiBiz(undefined, MODS);
  if (ctx instanceof NextResponse) return ctx;
  const all = ctx.user.role === "tenant_owner" || hasPermission(ctx.user, "biz:write");
  const days = Math.min(92, Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 31) || 31));
  const rows = await db.select({ id: biz_records.id, data: biz_records.data, created_at: biz_records.created_at }).from(biz_records)
    .where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "attendance"), gte(biz_records.created_at, new Date(Date.now() - days * 86_400_000)),
      all ? undefined : sql`${biz_records.data}->>'user_id' = ${ctx.user.id}`)).orderBy(desc(biz_records.created_at)).limit(2000);
  const open = rows.find((r) => (r.data as Record<string, unknown>).user_id === ctx.user.id && !(r.data as Record<string, unknown>).out);
  return NextResponse.json({ rows, all, open: open?.id ?? null });
}

export async function POST(req: NextRequest) {
  const ctx = await apiBiz(undefined, MODS, true);
  if (ctx instanceof NextResponse) return ctx;
  const p = z.object({ action: z.enum(["in", "out"]), note: z.string().trim().max(200).optional() }).strict().safeParse(await readJson(req));
  if (!p.success) return jsonError("INVALID_INPUT", 400);
  const res = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"att:" + ctx.user.id}))`);
    const [open] = await tx.select().from(biz_records).where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "attendance"),
      sql`${biz_records.data}->>'user_id' = ${ctx.user.id}`, sql`${biz_records.data}->>'out' is null`)).orderBy(desc(biz_records.created_at)).limit(1);
    const now = new Date();
    if (p.data.action === "in") {
      if (open) return "ALREADY_IN";
      await tx.insert(biz_records).values({ tenant_id: ctx.tenant.id, kind: "attendance", created_by: ctx.user.id, search: ctx.user.name.toLowerCase(),
        data: { user_id: ctx.user.id, name: ctx.user.name, in: now.toISOString(), note: p.data.note ?? "" } });
      return "OK";
    }
    if (!open) return "NOT_IN";
    const d = open.data as Record<string, unknown>;
    const minutes = Math.max(0, Math.round((now.getTime() - new Date(String(d.in)).getTime()) / 60000));
    await tx.update(biz_records).set({ data: { ...d, out: now.toISOString(), minutes }, updated_at: now }).where(eq(biz_records.id, open.id));
    return "OK";
  });
  if (res !== "OK") return jsonError(res, 409);
  await audit(ctx.user.id, ctx.tenant.id, `attendance.${p.data.action}`, "user", ctx.user.id);
  return NextResponse.json({ ok: true });
}

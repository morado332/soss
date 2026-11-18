import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { invoices, biz_records } from "@/db/schema";
import { audit, hasPermission } from "@/lib/auth";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { apiBiz } from "@/modules/business/access";

export const dynamic = "force-dynamic";

// Receivables (issued, unpaid invoices) and payables (unpaid purchases), aged in 0–30 / 31–60 / 61–90 / 90+ days.
export async function GET() {
  const ctx = await apiBiz("finance:read", ["debts"]);
  if (ctx instanceof NextResponse) return ctx;
  const recv = await db.select({ id: invoices.id, number: invoices.number, party: invoices.customer_name, email: invoices.customer_email, amount: invoices.total_cents, date: invoices.issued_at,
    days: sql<number>`floor(extract(epoch from (now() - ${invoices.issued_at})) / 86400)::int` })
    .from(invoices).where(and(eq(invoices.tenant_id, ctx.tenant.id), eq(invoices.type, "invoice"), eq(invoices.status, "issued"))).orderBy(asc(invoices.issued_at)).limit(1000);
  const pay = await db.select({ id: biz_records.id, data: biz_records.data, days: sql<number>`floor(extract(epoch from (now() - (${biz_records.data}->>'date')::date)) / 86400)::int` })
    .from(biz_records).where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "purchases"), sql`coalesce((${biz_records.data}->>'paid')::boolean, false) = false`)).limit(1000);
  return NextResponse.json({
    receivables: recv,
    payables: pay.map((p) => { const d = p.data as Record<string, unknown>; return { id: p.id, number: `EK-${String(d.no ?? "").padStart(4, "0")}`, party: d.supplier_name ?? "—", amount: Number(d.total ?? 0), date: d.date, days: p.days }; }),
    canPay: hasPermission(ctx.user, "invoices:write"),
  });
}

const Body = z.object({ kind: z.enum(["invoice", "purchase"]), id: z.string().uuid() }).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiBiz("invoices:write", ["debts"], true);
  if (ctx instanceof NextResponse) return ctx;
  const p = Body.safeParse(await readJson(req));
  if (!p.success) return jsonError("INVALID_INPUT", 400);
  if (p.data.kind === "invoice") {
    const r = await db.update(invoices).set({ status: "paid" }).where(and(eq(invoices.id, p.data.id), eq(invoices.tenant_id, ctx.tenant.id), eq(invoices.type, "invoice"), eq(invoices.status, "issued"))).returning({ id: invoices.id });
    if (!r.length) return jsonError("NOT_FOUND", 404);
  } else {
    const r = await db.update(biz_records).set({ data: sql`${biz_records.data} || '{"paid": true}'::jsonb`, updated_at: new Date() })
      .where(and(eq(biz_records.id, p.data.id), eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "purchases"))).returning({ id: biz_records.id });
    if (!r.length) return jsonError("NOT_FOUND", 404);
  }
  await audit(ctx.user.id, ctx.tenant.id, `debts.${p.data.kind}.paid`, p.data.kind, p.data.id);
  return NextResponse.json({ ok: true });
}

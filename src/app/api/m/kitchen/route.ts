import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, biz_records } from "@/db/schema";
import { audit } from "@/lib/auth";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { apiBiz } from "@/modules/business/access";

export const dynamic = "force-dynamic";
const MODS = ["kitchen"];
const FLOW = ["new", "preparing", "ready", "served", "cancelled"] as const;

export async function GET() {
  const ctx = await apiBiz("pos:use", MODS);
  if (ctx instanceof NextResponse) return ctx;
  const rows = await db.select().from(orders).where(and(eq(orders.tenant_id, ctx.tenant.id), eq(orders.source, "kitchen"),
    sql`(${orders.status} in ('new','preparing','ready') or ${orders.created_at} > now() - interval '12 hours')`)).orderBy(desc(orders.created_at)).limit(200);
  const tables = await db.select({ id: biz_records.id, data: biz_records.data }).from(biz_records).where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "tables")));
  return NextResponse.json({ rows, tables: tables.map((t) => ({ id: t.id, title: String((t.data as Record<string, unknown>).name ?? "") })) });
}

const Body = z.object({
  table: z.string().trim().max(60).optional().default(""),
  note: z.string().trim().max(300).optional().default(""),
  items: z.array(z.object({ product_id: z.string().uuid(), qty: z.number().int().min(1).max(99), note: z.string().trim().max(120).optional().default("") }).strict()).min(1).max(50),
}).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiBiz("pos:use", MODS, true);
  if (ctx instanceof NextResponse) return ctx;
  const p = Body.safeParse(await readJson(req));
  if (!p.success) return jsonError("INVALID_INPUT", 400);
  const ids = [...new Set(p.data.items.map((i) => i.product_id))];
  const prods = await db.select({ id: products.id, name: products.name, price: products.price_cents }).from(products).where(and(eq(products.tenant_id, ctx.tenant.id), inArray(products.id, ids)));
  if (prods.length !== ids.length) return jsonError("NOT_FOUND", 404);
  const items = p.data.items.map((i) => { const pr = prods.find((x) => x.id === i.product_id)!; return { product_id: pr.id, name: pr.name, qty: i.qty, note: i.note, price_cents: pr.price }; });
  const [o] = await db.insert(orders).values({ tenant_id: ctx.tenant.id, customer_name: p.data.table || null, items: { lines: items, note: p.data.note } as never,
    total_cents: items.reduce((s, i) => s + i.qty * i.price_cents, 0), status: "new", source: "kitchen" }).returning();
  if (p.data.table) await db.update(biz_records).set({ data: sql`${biz_records.data} || '{"status":"occupied"}'::jsonb` })
    .where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "tables"), sql`${biz_records.data}->>'name' = ${p.data.table}`));
  await audit(ctx.user.id, ctx.tenant.id, "kitchen.order", "order", o.id);
  return NextResponse.json({ ok: true, id: o.id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await apiBiz("pos:use", MODS, true);
  if (ctx instanceof NextResponse) return ctx;
  const p = z.object({ id: z.string().uuid(), status: z.enum(FLOW) }).strict().safeParse(await readJson(req));
  if (!p.success) return jsonError("INVALID_INPUT", 400);
  const r = await db.update(orders).set({ status: p.data.status }).where(and(eq(orders.id, p.data.id), eq(orders.tenant_id, ctx.tenant.id), eq(orders.source, "kitchen"))).returning({ id: orders.id });
  if (!r.length) return jsonError("NOT_FOUND", 404);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { biz_records, products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { apiBiz } from "@/modules/business/access";
import { nextNo } from "@/modules/business/validate";

export const dynamic = "force-dynamic";
const MODS = ["purchases"];
type Line = { product_id: string; name: string; qty: number; cost_cents: number };

export async function GET() {
  const ctx = await apiBiz("finance:read", MODS);
  if (ctx instanceof NextResponse) return ctx;
  const rows = await db.select({ id: biz_records.id, data: biz_records.data, created_at: biz_records.created_at }).from(biz_records)
    .where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "purchases"))).orderBy(desc(biz_records.created_at)).limit(500);
  return NextResponse.json(rows);
}

const Body = z.object({
  supplier: z.string().uuid().optional().or(z.literal("")),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  invoice_no: z.string().trim().max(60).optional().default(""),
  paid: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional().default(""),
  lines: z.array(z.object({ product_id: z.string().uuid(), qty: z.number().int().min(1).max(1_000_000), cost_cents: z.number().int().min(0).max(100_000_000) }).strict()).min(1).max(200),
}).strict();

// A purchase books goods in: stock += qty and the product's cost price is updated (used for profit calculation).
export async function POST(req: NextRequest) {
  const ctx = await apiBiz("finance:read", MODS, true);
  if (ctx instanceof NextResponse) return ctx;
  const p = Body.safeParse(await readJson(req));
  if (!p.success) return jsonError("INVALID_INPUT", 400);
  const d = p.data;
  const tid = ctx.tenant.id;
  let supplierName: string | null = null;
  if (d.supplier) {
    const [s] = await db.select({ data: biz_records.data }).from(biz_records).where(and(eq(biz_records.id, d.supplier), eq(biz_records.tenant_id, tid), eq(biz_records.kind, "suppliers"))).limit(1);
    if (!s) return jsonError("NOT_FOUND", 404, { field: "supplier" });
    supplierName = String((s.data as Record<string, unknown>).name ?? "");
  }
  const res = await db.transaction(async (tx) => {
    const ids = [...new Set(d.lines.map((l) => l.product_id))];
    const prods = await tx.select({ id: products.id, name: products.name }).from(products).where(and(eq(products.tenant_id, tid), inArray(products.id, ids))).for("update");
    if (prods.length !== ids.length) return null;
    const lines: Line[] = d.lines.map((l) => ({ ...l, name: prods.find((x) => x.id === l.product_id)!.name }));
    for (const l of lines) await tx.update(products).set({ stock: sql`${products.stock} + ${l.qty}`, cost_cents: l.cost_cents }).where(and(eq(products.id, l.product_id), eq(products.tenant_id, tid)));
    const total = lines.reduce((s, l) => s + l.qty * l.cost_cents, 0);
    const no = await nextNo(tx, tid, "purchases");
    const data = { no, supplier: d.supplier || null, supplier_name: supplierName, date: d.date, invoice_no: d.invoice_no, paid: d.paid, notes: d.notes, lines, total };
    const [r] = await tx.insert(biz_records).values({ tenant_id: tid, kind: "purchases", data, search: `${supplierName ?? ""} ${d.invoice_no} ${lines.map((l) => l.name).join(" ")}`.toLowerCase(), created_by: ctx.user.id }).returning();
    return r;
  });
  if (!res) return jsonError("NOT_FOUND", 404, { field: "product" });
  await audit(ctx.user.id, tid, "purchase.create", "biz_record", res.id, null, { total: (res.data as { total: number }).total });
  return NextResponse.json({ ok: true, row: res });
}

// Deleting a purchase books the goods out again.
export async function DELETE(req: NextRequest) {
  const ctx = await apiBiz("finance:read", MODS, true);
  if (ctx instanceof NextResponse) return ctx;
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return jsonError("INVALID_INPUT", 400);
  const ok = await db.transaction(async (tx) => {
    const [old] = await tx.delete(biz_records).where(and(eq(biz_records.id, id.data), eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, "purchases"))).returning();
    if (!old) return null;
    for (const l of ((old.data as { lines?: Line[] }).lines ?? [])) await tx.update(products).set({ stock: sql`${products.stock} - ${l.qty}` }).where(and(eq(products.id, l.product_id), eq(products.tenant_id, ctx.tenant.id)));
    return old;
  });
  if (!ok) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, "purchase.delete", "biz_record", ok.id, ok.data, null);
  return NextResponse.json({ ok: true });
}

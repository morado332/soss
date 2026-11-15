import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { centsSchema, clientIp, readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant();
  if (ctx instanceof NextResponse) return ctx;
  const rows = await db.select({
    id: products.id, name: products.name, barcode: products.barcode, sku: products.sku, category: products.category,
    price_cents: products.price_cents, stock: products.stock, low_stock_threshold: products.low_stock_threshold, is_active: products.is_active,
  }).from(products).where(eq(products.tenant_id, ctx.tenant.id)).orderBy(asc(products.name));
  return NextResponse.json(rows);
}

const Fields = {
  name: z.string().trim().min(1).max(200),
  barcode: z.string().trim().max(64).regex(/^[0-9A-Za-z\-]*$/).optional(),
  sku: z.string().trim().max(64).optional(),
  category: z.string().trim().max(100).optional(),
  price_cents: centsSchema,
  cost_cents: centsSchema.optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  low_stock_threshold: z.number().int().min(0).max(1_000_000).optional(),
};
const CreateBody = z.object(Fields).strict();
const PatchBody = z.object({ id: z.string().uuid(), is_active: z.boolean().optional(), ...Object.fromEntries(Object.entries(Fields).map(([k, v]) => [k, v.optional()])) }).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiTenant("products:write", { write: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = CreateBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const [row] = await db.insert(products).values({ ...parsed.data, barcode: parsed.data.barcode || null, tenant_id: ctx.tenant.id }).returning();
  await audit(ctx.user.id, ctx.tenant.id, "product.create", "product", row.id, null, { name: row.name, price_cents: row.price_cents }, clientIp(req));
  return NextResponse.json({ ok: true, product: row });
}

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("products:write", { write: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = PatchBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const { id, ...patch } = parsed.data;
  const where = and(eq(products.id, id), eq(products.tenant_id, ctx.tenant.id));
  const [old] = await db.select().from(products).where(where).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  const [row] = await db.update(products).set(patch).where(where).returning();
  await audit(ctx.user.id, ctx.tenant.id, "product.update", "product", id, { price_cents: old.price_cents, stock: old.stock, is_active: old.is_active }, patch, clientIp(req));
  return NextResponse.json({ ok: true, product: row });
}

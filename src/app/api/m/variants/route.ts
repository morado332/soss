import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { apiBiz } from "@/modules/business/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiBiz("products:write", ["variants"]);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(await db.select({ id: products.id, name: products.name, category: products.category, stock: products.stock, barcode: products.barcode, variants: products.variants })
    .from(products).where(and(eq(products.tenant_id, ctx.tenant.id), eq(products.is_active, true))).orderBy(asc(products.name)).limit(2000));
}

const V = z.object({
  size: z.string().trim().min(1).max(20), color: z.string().trim().min(1).max(30),
  color_code: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), stock: z.number().int().min(0).max(1_000_000),
  barcode: z.string().trim().max(32).regex(/^[0-9A-Za-z\-]*$/).optional().default(""), sku: z.string().trim().max(40).optional().default(""),
}).strict();

// Size/colour matrix for one product; the product stock becomes the sum of its variants.
export async function PATCH(req: NextRequest) {
  const ctx = await apiBiz("products:write", ["variants"], true);
  if (ctx instanceof NextResponse) return ctx;
  const p = z.object({ product_id: z.string().uuid(), variants: z.array(V).max(300) }).strict().safeParse(await readJson(req));
  if (!p.success) return jsonError("INVALID_INPUT", 400);
  const keys = new Set(p.data.variants.map((v) => `${v.size.toLowerCase()}|${v.color.toLowerCase()}`));
  if (keys.size !== p.data.variants.length) return jsonError("DUPLICATE", 409);
  const stock = p.data.variants.reduce((s, v) => s + v.stock, 0);
  const r = await db.update(products).set({ variants: p.data.variants, ...(p.data.variants.length ? { stock } : {}) })
    .where(and(eq(products.id, p.data.product_id), eq(products.tenant_id, ctx.tenant.id))).returning({ id: products.id });
  if (!r.length) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, "product.variants", "product", p.data.product_id, null, { count: p.data.variants.length, stock });
  return NextResponse.json({ ok: true, stock });
}

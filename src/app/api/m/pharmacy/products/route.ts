import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant("pos:use", { module: "pharmacy" });
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(await db.select({ id: products.id, name: products.name, category: products.category, price_cents: products.price_cents, stock: products.stock, rx_required: products.rx_required, reservable: products.reservable })
    .from(products).where(and(eq(products.tenant_id, ctx.tenant.id), eq(products.is_active, true))).orderBy(asc(products.name)).limit(1000));
}

// Flags per medicine: may it be reserved online, and does it need a prescription (Rx = reserve only, never paid online).
export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("products:write", { write: true, module: "pharmacy" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ id: z.string().uuid(), reservable: z.boolean().optional(), rx_required: z.boolean().optional() }).strict().safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const { id, ...set } = parsed.data;
  const r = await db.update(products).set(set).where(and(eq(products.id, id), eq(products.tenant_id, ctx.tenant.id))).returning({ id: products.id });
  if (!r.length) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, "pharmacy.product.flags", "product", id, null, set);
  return NextResponse.json({ ok: true });
}

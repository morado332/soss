import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { apiTenant, jsonError } from "@/lib/guard";

export const dynamic = "force-dynamic";

// Small pickers for forms: colleagues (id + name) and products (id + name + barcode) of the own business only.
export async function GET(req: NextRequest) {
  const ctx = await apiTenant();
  if (ctx instanceof NextResponse) return ctx;
  const type = req.nextUrl.searchParams.get("type");
  if (type === "staff") return NextResponse.json(await db.select({ id: users.id, title: users.name }).from(users).where(and(eq(users.tenant_id, ctx.tenant.id), eq(users.is_active, true))).orderBy(asc(users.name)));
  if (type === "product") return NextResponse.json(await db.select({ id: products.id, title: products.name, barcode: products.barcode, price_cents: products.price_cents, cost_cents: products.cost_cents, stock: products.stock })
    .from(products).where(and(eq(products.tenant_id, ctx.tenant.id), eq(products.is_active, true))).orderBy(asc(products.name)).limit(2000));
  return jsonError("INVALID_INPUT", 400);
}

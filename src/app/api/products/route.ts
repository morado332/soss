import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireUser, assertTenantAccess, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";
const Body = z.object({
  name: z.string().min(1).max(200), barcode: z.string().max(50).optional(), sku: z.string().max(50).optional(),
  category: z.string().max(100).optional(), price_cents: z.number().int().min(0), cost_cents: z.number().int().min(0).optional(),
  stock: z.number().int().min(0).optional(), low_stock_threshold: z.number().int().min(0).optional(),
  variants: z.array(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.tenant_id && user.role !== "root") return NextResponse.json({ error: "TENANT_REQUIRED" }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
  const tenantId = user.tenant_id!;
  assertTenantAccess(user, tenantId);
  const [row] = await db.insert(products).values({ tenant_id: tenantId, ...parsed.data }).returning();
  await audit(user.id, tenantId, "product.create", "product", row.id, null, row, req.headers.get("x-forwarded-for") ?? undefined);
  return NextResponse.json({ ok: true, product: row });
}

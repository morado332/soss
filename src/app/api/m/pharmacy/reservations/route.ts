import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { RES_STATUS, type ReservationItem } from "@/modules/pharmacy/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant("pos:use", { module: "pharmacy" });
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(await db.select().from(orders).where(and(eq(orders.tenant_id, ctx.tenant.id), eq(orders.source, "reservation"))).orderBy(desc(orders.created_at)).limit(300));
}

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("pos:use", { write: true, module: "pharmacy" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ id: z.string().uuid(), status: z.enum(RES_STATUS) }).strict().safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const res = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(and(eq(orders.id, parsed.data.id), eq(orders.tenant_id, ctx.tenant.id), eq(orders.source, "reservation"))).for("update").limit(1);
    if (!o) return "NOT_FOUND";
    if (o.status === "picked_up" || o.status === "cancelled") return "INVALID_STATE";
    // stock is held at reservation time; give it back when cancelled
    if (parsed.data.status === "cancelled") {
      for (const it of (o.items ?? []) as ReservationItem[]) {
        await tx.update(products).set({ stock: sql`${products.stock} + ${it.qty}` }).where(and(eq(products.id, it.product_id), eq(products.tenant_id, ctx.tenant.id)));
      }
    }
    await tx.update(orders).set({ status: parsed.data.status }).where(eq(orders.id, o.id));
    return "OK";
  });
  if (res !== "OK") return jsonError(res, res === "NOT_FOUND" ? 404 : 409);
  await audit(ctx.user.id, ctx.tenant.id, "pharmacy.reservation." + parsed.data.status, "order", parsed.data.id);
  return NextResponse.json({ ok: true });
}

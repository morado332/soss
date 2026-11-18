import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiBiz } from "@/modules/business/access";
import { internalEan } from "@/lib/barcode";

export const dynamic = "force-dynamic";

// Gives every product without a barcode a unique in-store EAN-13 (20…/29… range).
export async function POST() {
  const ctx = await apiBiz("products:write", ["barcode"], true);
  if (ctx instanceof NextResponse) return ctx;
  const tid = ctx.tenant.id;
  const n = await db.transaction(async (tx) => {
    const all = await tx.select({ id: products.id, barcode: products.barcode }).from(products).where(eq(products.tenant_id, tid)).for("update");
    const used = new Set(all.map((p) => p.barcode).filter(Boolean));
    const missing = await tx.select({ id: products.id }).from(products).where(and(eq(products.tenant_id, tid), or(isNull(products.barcode), eq(products.barcode, ""))));
    for (const p of missing) {
      let code = internalEan(() => randomInt(0, 1_000_000) / 1_000_000);
      while (used.has(code)) code = internalEan(() => randomInt(0, 1_000_000) / 1_000_000);
      used.add(code);
      await tx.update(products).set({ barcode: code }).where(and(eq(products.id, p.id), eq(products.tenant_id, tid)));
    }
    return missing.length;
  });
  await audit(ctx.user.id, tid, "barcode.generate", "product", undefined, null, { count: n });
  return NextResponse.json({ ok: true, generated: n });
}

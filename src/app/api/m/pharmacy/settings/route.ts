import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { pickupHours, reservationFee } from "@/modules/pharmacy/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant("pos:use", { module: "pharmacy" });
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ fee_cents: reservationFee(ctx.tenant), hold_hours: pickupHours(ctx.tenant), stripe_connected: !!ctx.tenant.stripe_account_id });
}

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant(undefined, { write: true, ownerOnly: true, module: "pharmacy" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ fee_cents: z.number().int().min(0).max(5000), hold_hours: z.number().int().min(1).max(336) }).strict().safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const settings = { ...((ctx.tenant.settings ?? {}) as Record<string, unknown>), pharmacy_fee_cents: parsed.data.fee_cents, pharmacy_hold_hours: parsed.data.hold_hours };
  await db.update(tenants).set({ settings, updated_at: new Date() }).where(eq(tenants.id, ctx.tenant.id));
  await audit(ctx.user.id, ctx.tenant.id, "pharmacy.settings", "tenant", ctx.tenant.id, null, parsed.data);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const [t] = await db.select().from(tenants).where(eq(tenants.id, user.tenant_id)).limit(1);
  return NextResponse.json(t ?? {});
}
const Body = z.object({ commission_percent_bp: z.number().int().min(0).max(5000).optional(), commission_fixed_cents: z.number().int().min(0).optional(), tax_rate_bp: z.number().int().optional(), terminal_id: z.string().max(100).optional() });
export async function PATCH(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const [old] = await db.select().from(tenants).where(eq(tenants.id, user.tenant_id)).limit(1);
  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (parsed.data.commission_percent_bp != null) patch.commission_percent = parsed.data.commission_percent_bp;
  if (parsed.data.commission_fixed_cents != null) patch.commission_fixed_cents = parsed.data.commission_fixed_cents;
  if (parsed.data.tax_rate_bp != null) patch.tax_rate_bp = parsed.data.tax_rate_bp;
  if (parsed.data.terminal_id != null) patch.terminal_id = parsed.data.terminal_id;
  const [row] = await db.update(tenants).set(patch).where(eq(tenants.id, user.tenant_id)).returning();
  await audit(user.id, user.tenant_id, "tenant.settings", "tenant", user.tenant_id, old, row);
  return NextResponse.json({ ok: true, tenant: row });
}

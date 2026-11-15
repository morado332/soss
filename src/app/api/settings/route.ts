import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { clientIp, readJson, taxRateSchema } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant();
  if (ctx instanceof NextResponse) return ctx;
  const t = ctx.tenant;
  const isOwner = ctx.user.role === "tenant_owner";
  return NextResponse.json({
    name: t.name, slug: t.slug, profession: t.profession, status: t.status, plan: t.plan, monthly_fee_cents: t.monthly_fee_cents,
    commission_percent: t.commission_percent, commission_fixed_cents: t.commission_fixed_cents, tax_rate_bp: t.tax_rate_bp,
    ust_idnr: t.ust_idnr, steuernummer: t.steuernummer, terminal_id: t.terminal_id, tse_serial: t.tse_serial,
    iban: isOwner ? t.iban : null, stripe_connected: !!t.stripe_account_id, is_owner: isOwner,
  });
}

// NOTE: commission rates are deliberately NOT editable by tenants — only platform admins can change them.
const Body = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  ust_idnr: z.string().trim().max(20).regex(/^[A-Z0-9 ]*$/i).optional(),
  steuernummer: z.string().trim().max(30).regex(/^[0-9/ ]*$/).optional(),
  iban: z.string().trim().max(34).regex(/^[A-Z0-9 ]*$/i).optional(),
  terminal_id: z.string().trim().max(100).regex(/^[A-Za-z0-9_\-]*$/).optional(),
  tax_rate_bp: taxRateSchema.optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("settings:write", { write: true, ownerOnly: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const patch = { ...parsed.data, updated_at: new Date() } as Record<string, unknown>;
  for (const k of ["ust_idnr", "steuernummer", "iban", "terminal_id"]) if (patch[k] === "") patch[k] = null;
  const old = ctx.tenant;
  await db.update(tenants).set(patch).where(eq(tenants.id, old.id));
  const changed = Object.fromEntries(Object.keys(parsed.data).map((k) => [k, k === "iban" ? "***" : (parsed.data as Record<string, unknown>)[k]]));
  await audit(ctx.user.id, old.id, "tenant.settings", "tenant", old.id, null, changed, clientIp(req));
  return NextResponse.json({ ok: true });
}

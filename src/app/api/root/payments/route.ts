import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiRoot, jsonError } from "@/lib/guard";
import { clientIp, readJson } from "@/lib/security";
import { getPaymentConfig, setSetting } from "@/core/platform";
import { decryptSecret, encryptSecret, maskSecret } from "@/core/secrets";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiRoot("platform:payments");
  if (user instanceof NextResponse) return user;
  const cfg = await getPaymentConfig();
  const list = await db.select({
    id: tenants.id, name: tenants.name, profession: tenants.profession, stripe_account_id: tenants.stripe_account_id,
    readers: sql<number>`(select count(*)::int from terminal_readers r where r.tenant_id = "tenants"."id" and r.is_active)`,
  }).from(tenants).orderBy(asc(tenants.name));
  // Secrets never leave the server: only masked previews.
  return NextResponse.json({
    platform: {
      stripePublishable: cfg.stripePublishable,
      stripeSecret: maskSecret(decryptSecret(cfg.stripeSecret)),
      stripeWebhookSecret: maskSecret(decryptSecret(cfg.stripeWebhookSecret)),
      sumupApiKey: maskSecret(decryptSecret(cfg.sumupApiKey)),
      webhookUrl: "/api/webhooks/stripe",
    },
    tenants: list,
  });
}

const Body = z.object({
  stripePublishable: z.string().trim().regex(/^(pk_(test|live)_[A-Za-z0-9]{10,200})?$/).optional(),
  stripeSecret: z.string().trim().regex(/^((sk|rk)_(test|live)_[A-Za-z0-9]{10,200})?$/).optional(),
  stripeWebhookSecret: z.string().trim().regex(/^(whsec_[A-Za-z0-9]{10,200})?$/).optional(),
  sumupApiKey: z.string().trim().regex(/^([A-Za-z0-9_\-]{10,300})?$/).optional(),
  clear: z.array(z.enum(["stripeSecret", "stripeWebhookSecret", "sumupApiKey"])).optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const user = await apiRoot("platform:payments");
  if (user instanceof NextResponse) return user;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_KEY_FORMAT", 400);
  const d = parsed.data;
  const cfg = await getPaymentConfig();
  const next = { ...cfg };
  if (d.stripePublishable !== undefined) next.stripePublishable = d.stripePublishable;
  for (const k of ["stripeSecret", "stripeWebhookSecret", "sumupApiKey"] as const) if (d[k]) next[k] = encryptSecret(d[k]!);
  for (const k of d.clear ?? []) next[k] = null;
  await setSetting("payments", next);
  await audit(user.id, null, "platform.payments.update", "platform", undefined, null,
    { changed: Object.keys(d).filter((k) => k !== "clear" && (d as Record<string, unknown>)[k]), cleared: d.clear ?? [] }, clientIp(req));
  return NextResponse.json({ ok: true });
}

// Per business: Stripe Connect account id
const TenantBody = z.object({ tenant_id: z.string().uuid(), stripe_account_id: z.string().trim().regex(/^(acct_[A-Za-z0-9]{8,64})?$/) }).strict();

export async function PUT(req: NextRequest) {
  const user = await apiRoot("platform:payments");
  if (user instanceof NextResponse) return user;
  const parsed = TenantBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_KEY_FORMAT", 400);
  const [old] = await db.select({ acct: tenants.stripe_account_id }).from(tenants).where(eq(tenants.id, parsed.data.tenant_id)).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  await db.update(tenants).set({ stripe_account_id: parsed.data.stripe_account_id || null, updated_at: new Date() }).where(eq(tenants.id, parsed.data.tenant_id));
  await audit(user.id, parsed.data.tenant_id, "tenant.stripe_account", "tenant", parsed.data.tenant_id, { stripe_account_id: old.acct }, { stripe_account_id: parsed.data.stripe_account_id || null }, clientIp(req));
  return NextResponse.json({ ok: true });
}

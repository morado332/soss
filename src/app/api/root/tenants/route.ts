import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, users, subscriptions, tenant_features } from "@/db/schema";
import { audit, hashPassword, destroyAllSessions } from "@/lib/auth";
import { apiRoot, jsonError } from "@/lib/guard";
import { PROFESSIONS, professionByKey } from "@/lib/professions";
import { clientIp, emailSchema, passwordSchema, readJson, taxRateSchema } from "@/lib/security";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiRoot();
  if (user instanceof NextResponse) return user;
  const rows = await db.select({
    id: tenants.id, name: tenants.name, slug: tenants.slug, profession: tenants.profession, status: tenants.status, plan: tenants.plan,
    monthly_fee_cents: tenants.monthly_fee_cents, commission_percent: tenants.commission_percent, commission_fixed_cents: tenants.commission_fixed_cents,
    tax_rate_bp: tenants.tax_rate_bp, created_at: tenants.created_at,
    owner_email: sql<string | null>`(select email from users u where u.tenant_id = ${tenants.id} and u.role = 'tenant_owner' order by u.created_at limit 1)`,
  }).from(tenants).orderBy(desc(tenants.created_at));
  return NextResponse.json(rows);
}

const professionKeys = PROFESSIONS.map((p) => p.key) as [string, ...string[]];
const CreateBody = z.object({
  name: z.string().trim().min(2).max(200),
  profession: z.enum(professionKeys),
  owner_name: z.string().trim().min(2).max(120),
  owner_email: emailSchema,
  owner_password: passwordSchema,
  plan: z.enum(["starter", "pro", "business"]).default("pro"),
  commission_percent_bp: z.number().int().min(0).max(3000).default(500),
  commission_fixed_cents: z.number().int().min(0).max(1000).default(30),
  tax_rate_bp: taxRateSchema.default(1900),
}).strict();

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "shop";

export async function POST(req: NextRequest) {
  const user = await apiRoot();
  if (user instanceof NextResponse) return user;
  const parsed = CreateBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues.some((i) => i.path[0] === "owner_password") ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  const d = parsed.data;
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.owner_email)).limit(1);
  if (taken) return jsonError("EMAIL_TAKEN", 409);
  const prof = professionByKey(d.profession);
  const slug = `${slugify(d.name)}-${randomBytes(3).toString("hex")}`;
  const fee = prof.monthlyFee * 100;
  const hash = await hashPassword(d.owner_password);
  const tenant = await db.transaction(async (tx) => {
    const [t] = await tx.insert(tenants).values({
      name: d.name, slug, profession: d.profession, status: "active", plan: d.plan, monthly_fee_cents: fee,
      commission_percent: d.commission_percent_bp, commission_fixed_cents: d.commission_fixed_cents, tax_rate_bp: d.tax_rate_bp,
    }).returning();
    await tx.insert(users).values({ email: d.owner_email, password_hash: hash, name: d.owner_name, role: "tenant_owner", tenant_id: t.id, permissions: ["*"] });
    await tx.insert(subscriptions).values({ tenant_id: t.id, plan: d.plan, status: "active", monthly_fee_cents: fee });
    await tx.insert(tenant_features).values(["appointments", "pos", "invoices", "accountant", "ai"].map((k) => ({ tenant_id: t.id, feature_key: k })));
    return t;
  });
  await audit(user.id, tenant.id, "tenant.create", "tenant", tenant.id, null, { name: d.name, profession: d.profession, owner: d.owner_email }, clientIp(req));
  return NextResponse.json({ ok: true, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug }, booking_url: `/book/${slug}` });
}

const PatchBody = z.object({
  tenant_id: z.string().uuid(),
  status: z.enum(["active", "suspended", "trial", "past_due", "cancelled"]).optional(),
  plan: z.enum(["starter", "pro", "business"]).optional(),
  commission_percent_bp: z.number().int().min(0).max(3000).optional(),
  commission_fixed_cents: z.number().int().min(0).max(1000).optional(),
  tax_rate_bp: taxRateSchema.optional(),
  owner_password: passwordSchema.optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const user = await apiRoot();
  if (user instanceof NextResponse) return user;
  const parsed = PatchBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues.some((i) => i.path[0] === "owner_password") ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  const d = parsed.data;
  const [old] = await db.select().from(tenants).where(eq(tenants.id, d.tenant_id)).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (d.status) patch.status = d.status;
  if (d.plan) patch.plan = d.plan;
  if (d.commission_percent_bp != null) patch.commission_percent = d.commission_percent_bp;
  if (d.commission_fixed_cents != null) patch.commission_fixed_cents = d.commission_fixed_cents;
  if (d.tax_rate_bp != null) patch.tax_rate_bp = d.tax_rate_bp;
  await db.update(tenants).set(patch).where(eq(tenants.id, d.tenant_id));
  if (d.owner_password) {
    const [owner] = await db.select({ id: users.id }).from(users).where(and(eq(users.tenant_id, d.tenant_id), eq(users.role, "tenant_owner"))).limit(1);
    if (owner) {
      await db.update(users).set({ password_hash: await hashPassword(d.owner_password), password_changed_at: new Date(), failed_login_count: 0, locked_until: null }).where(eq(users.id, owner.id));
      await destroyAllSessions(owner.id);
    }
  }
  const { owner_password, ...logged } = d;
  await audit(user.id, old.id, owner_password ? "tenant.update+owner_password_reset" : "tenant.update", "tenant", old.id,
    { status: old.status, plan: old.plan, commission_percent: old.commission_percent, commission_fixed_cents: old.commission_fixed_cents, tax_rate_bp: old.tax_rate_bp }, logged, clientIp(req));
  return NextResponse.json({ ok: true });
}

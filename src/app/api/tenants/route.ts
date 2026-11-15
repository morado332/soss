import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { tenants, users, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser, audit, hashPassword } from "@/lib/auth";
import { professionByKey } from "@/lib/professions";

export const dynamic = "force-dynamic";

// Root: manual account creation — profession → username/password → activate features (Section 3)
const CreateBody = z.object({
  name: z.string().min(1).max(200), profession: z.string().min(1), owner_email: z.string().email(), owner_password: z.string().min(8).max(200),
  owner_name: z.string().min(1).max(200), plan: z.string().default("pro"),
  commission_percent_bp: z.number().int().min(0).max(5000).default(500), commission_fixed_cents: z.number().int().min(0).default(30), tax_rate_bp: z.number().int().default(1900),
});

export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user || (user.role !== "root" && user.role !== "super_admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const d = parsed.data;
  const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 6);
  const prof = professionByKey(d.profession);
  const [tenant] = await db.insert(tenants).values({
    name: d.name, slug, profession: d.profession, status: "active", plan: d.plan, monthly_fee_cents: prof.monthlyFee * 100,
    commission_percent: d.commission_percent_bp, commission_fixed_cents: d.commission_fixed_cents, tax_rate_bp: d.tax_rate_bp,
  }).returning();
  const [owner] = await db.insert(users).values({
    email: d.owner_email.toLowerCase(), password_hash: await hashPassword(d.owner_password), name: d.owner_name, role: "tenant_owner", tenant_id: tenant.id, permissions: ["*"],
  }).returning();
  await db.insert(subscriptions).values({ tenant_id: tenant.id, plan: d.plan, status: "active", monthly_fee_cents: prof.monthlyFee * 100 });
  await audit(user.id, tenant.id, "tenant.create", "tenant", tenant.id, null, { name: d.name, profession: d.profession, owner: owner.email }, req.headers.get("x-forwarded-for") ?? undefined);
  return NextResponse.json({ ok: true, tenant, owner_email: owner.email, booking_url: `/book/${slug}` });
}

const PatchBody = z.object({ tenant_id: z.string().uuid(), status: z.enum(["active", "suspended", "trial", "past_due", "cancelled"]).optional(), commission_percent_bp: z.number().int().optional(), commission_fixed_cents: z.number().int().optional(), tax_rate_bp: z.number().int().optional() });

export async function PATCH(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user || (user.role !== "root" && user.role !== "super_admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const [old] = await db.select().from(tenants).where(eq(tenants.id, parsed.data.tenant_id)).limit(1);
  if (!old) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const patch: Record<string, unknown> = {};
  if (parsed.data.status) patch.status = parsed.data.status;
  if (parsed.data.commission_percent_bp != null) patch.commission_percent = parsed.data.commission_percent_bp;
  if (parsed.data.commission_fixed_cents != null) patch.commission_fixed_cents = parsed.data.commission_fixed_cents;
  if (parsed.data.tax_rate_bp != null) patch.tax_rate_bp = parsed.data.tax_rate_bp;
  patch.updated_at = new Date();
  const [row] = await db.update(tenants).set(patch).where(eq(tenants.id, parsed.data.tenant_id)).returning();
  await audit(user.id, row.id, "tenant.update", "tenant", row.id, old, row, req.headers.get("x-forwarded-for") ?? undefined);
  return NextResponse.json({ ok: true, tenant: row });
}

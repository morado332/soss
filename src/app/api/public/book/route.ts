import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, services, appointments, notifications, biz_records } from "@/db/schema";
import { hasConflict } from "@/lib/appointments";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, readJson } from "@/lib/security";
import { jsonError } from "@/lib/guard";

export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  customer_name: z.string().trim().min(2).max(120),
  customer_email: z.string().trim().email().max(254),
  customer_phone: z.string().trim().max(40).regex(/^[0-9+()\/\-\s]*$/).optional(),
  service_id: z.string().uuid().optional(),
  starts_at: z.string().datetime({ offset: true }),
  website: z.string().max(0).optional(), // honeypot field — must stay empty
}).strict();

// Public booking (end customers, no login). Tenant resolved by slug; service must belong to that tenant.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`book:${ip}`, 8, 10 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const d = parsed.data;
  const [tenant] = await db.select({ id: tenants.id, name: tenants.name }).from(tenants)
    .where(and(eq(tenants.slug, d.slug), inArray(tenants.status, ["active", "trial", "past_due"]))).limit(1);
  if (!tenant) return jsonError("NOT_FOUND", 404);
  if (!rateLimit(`book:tenant:${tenant.id}`, 60, 60 * 60_000).ok) return jsonError("RATE_LIMITED", 429);

  let duration = 30;
  if (d.service_id) {
    const [svc] = await db.select().from(services).where(and(eq(services.id, d.service_id), eq(services.tenant_id, tenant.id), eq(services.is_active, true))).limit(1);
    if (!svc) return jsonError("NOT_FOUND", 404);
    duration = svc.duration_minutes;
  }
  const starts = new Date(d.starts_at);
  if (starts.getTime() < Date.now() + 5 * 60_000) return jsonError("PAST_TIME", 400);
  if (starts.getTime() > Date.now() + 365 * 86_400_000) return jsonError("INVALID_INPUT", 400);
  const ends = new Date(starts.getTime() + duration * 60000);
  // closing days / holidays entered by the business block online booking (dates compared in Europe/Berlin)
  const day = starts.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const [closed] = await db.select({ id: biz_records.id }).from(biz_records).where(and(eq(biz_records.tenant_id, tenant.id), eq(biz_records.kind, "closing_days"),
    sql`${biz_records.data}->>'from' <= ${day}`, sql`${biz_records.data}->>'to' >= ${day}`)).limit(1);
  if (closed) return jsonError("CLOSED_DAY", 409);

  const ok = await db.transaction(async (tx) => {
    if (await hasConflict(tx, tenant.id, starts, ends)) return false;
    await tx.insert(appointments).values({
      tenant_id: tenant.id, customer_name: d.customer_name, customer_email: d.customer_email, customer_phone: d.customer_phone || null,
      service_id: d.service_id ?? null, starts_at: starts, ends_at: ends, status: "scheduled", source: "public_link",
    });
    await tx.insert(notifications).values({ tenant_id: tenant.id, title: "Neue Online-Buchung", body: `${d.customer_name} — ${starts.toISOString().slice(0, 16).replace("T", " ")} UTC`, type: "booking" });
    return true;
  });
  if (!ok) return jsonError("CONFLICT", 409);
  // Only minimal data is returned to the anonymous caller.
  return NextResponse.json({ ok: true, business: tenant.name, starts_at: starts.toISOString() });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { tenants, services, appointments, notifications, orders } from "@/db/schema";
import { eq, and, lt, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";
const Body = z.object({
  slug: z.string().min(1), customer_name: z.string().min(1).max(200), customer_email: z.string().email().optional(),
  customer_phone: z.string().max(50).optional(), service_id: z.string().uuid().optional(), starts_at: z.string().datetime(), duration_minutes: z.number().int().default(30),
});

// Public booking link per tenant (End Customer role) — no login required, tenant resolved by slug
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, parsed.data.slug)).limit(1);
  if (!tenant || tenant.status === "suspended") return NextResponse.json({ error: "Geschäft nicht verfügbar" }, { status: 404 });
  const starts = new Date(parsed.data.starts_at);
  const ends = new Date(starts.getTime() + parsed.data.duration_minutes * 60000);
  const clash = await db.select().from(appointments).where(and(eq(appointments.tenant_id, tenant.id), lt(appointments.starts_at, ends), gt(appointments.ends_at, starts))).limit(1);
  if (clash.length) return NextResponse.json({ error: "Dieser Zeitpunkt ist leider belegt." }, { status: 409 });
  const [row] = await db.insert(appointments).values({
    tenant_id: tenant.id, customer_name: parsed.data.customer_name, customer_email: parsed.data.customer_email, customer_phone: parsed.data.customer_phone,
    service_id: parsed.data.service_id ?? null, starts_at: starts, ends_at: ends, status: "scheduled", source: "public_link",
  }).returning();
  await db.insert(notifications).values({ tenant_id: tenant.id, title: "Neue Online-Buchung", body: `${parsed.data.customer_name} — ${starts.toLocaleString("de-DE")}`, type: "booking" });
  // Pharmacy: prescription orders are booking-only (no online payment) — handled via orders table in shop flow
  void services; void orders;
  return NextResponse.json({ ok: true, appointment: row, business: tenant.name });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { appointments, services, notifications } from "@/db/schema";
import { and, eq, lt, gt } from "drizzle-orm";
import { requireUser, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";
const Body = z.object({
  customer_name: z.string().min(1).max(200), customer_email: z.string().email().optional(), customer_phone: z.string().max(50).optional(),
  service_id: z.string().uuid().optional(), starts_at: z.string().datetime(), duration_minutes: z.number().int().min(5).max(480).default(30),
  notes: z.string().max(1000).optional(), source: z.string().default("dashboard"),
});

// Conflict check: no overlapping appointment for same tenant in same window (Section 7)
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const starts = new Date(parsed.data.starts_at);
  const ends = new Date(starts.getTime() + parsed.data.duration_minutes * 60000);
  const clash = await db.select().from(appointments)
    .where(and(eq(appointments.tenant_id, user.tenant_id), lt(appointments.starts_at, ends), gt(appointments.ends_at, starts)))
    .limit(1);
  if (clash.length) return NextResponse.json({ error: "Zeitkonflikt: Termin überschneidet sich mit einem bestehenden Termin." }, { status: 409 });
  if (parsed.data.service_id) {
    const [svc] = await db.select().from(services).where(and(eq(services.id, parsed.data.service_id), eq(services.tenant_id, user.tenant_id))).limit(1);
    if (!svc) return NextResponse.json({ error: "Service gehört nicht zu Ihrem Geschäft (Tenant-Isolation)." }, { status: 403 });
  }
  const [row] = await db.insert(appointments).values({
    tenant_id: user.tenant_id, customer_name: parsed.data.customer_name, customer_email: parsed.data.customer_email,
    customer_phone: parsed.data.customer_phone, service_id: parsed.data.service_id, starts_at: starts, ends_at: ends,
    notes: parsed.data.notes, source: parsed.data.source, status: "scheduled",
  }).returning();
  await db.insert(notifications).values({ tenant_id: user.tenant_id, title: "Neue Buchung", body: `${parsed.data.customer_name} — ${starts.toLocaleString("de-DE")}`, type: "booking" });
  await audit(user.id, user.tenant_id, "appointment.create", "appointment", row.id, null, row);
  return NextResponse.json({ ok: true, appointment: row });
}

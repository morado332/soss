import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { invoices, invoice_items, tenants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireUser, audit } from "@/lib/auth";

export const dynamic = "force-dynamic";
const Body = z.object({
  customer_name: z.string().min(1).max(200), customer_email: z.string().email().optional(),
  items: z.array(z.object({ name: z.string().min(1), quantity: z.number().int().min(1), unit_price_cents: z.number().int().min(0) })).min(1),
  tax_rate_bp: z.number().int().default(1900),
});

// Create invoice (GoBD: never edited/deleted after issue — correction via Storno)
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const tid = user.tenant_id;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
  const gross = parsed.data.items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0);
  const tax = Math.round((gross * parsed.data.tax_rate_bp) / (10000 + parsed.data.tax_rate_bp));
  const [{ value: seq }] = await db.select({ value: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.tenant_id, tid));
  const number = `${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`;
  const [inv] = await db.insert(invoices).values({
    tenant_id: tid, number, type: "invoice", status: "issued", customer_name: parsed.data.customer_name, customer_email: parsed.data.customer_email,
    subtotal_cents: gross - tax, tax_cents: tax, total_cents: gross, tax_rate_bp: parsed.data.tax_rate_bp,
    tse_reference: `FISKALY-TSE-${tenant?.tse_serial ?? "DEMO"}-${Date.now()}`,
  }).returning();
  for (const i of parsed.data.items) await db.insert(invoice_items).values({ invoice_id: inv.id, tenant_id: tid, name: i.name, quantity: i.quantity, unit_price_cents: i.unit_price_cents, total_cents: i.quantity * i.unit_price_cents });
  await audit(user.id, tid, "invoice.create", "invoice", inv.id, null, inv);
  return NextResponse.json({ ok: true, invoice: inv });
}

// Storno: creates a cancelling invoice linked to the original (GoBD-compliant)
export async function PATCH(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { invoice_id } = (await req.json().catch(() => ({}))) as { invoice_id?: string };
  if (!invoice_id) return NextResponse.json({ error: "invoice_id erforderlich" }, { status: 400 });
  const [orig] = await db.select().from(invoices).where(eq(invoices.id, invoice_id)).limit(1);
  if (!orig || orig.tenant_id !== user.tenant_id) return NextResponse.json({ error: "Nicht gefunden / kein Zugriff" }, { status: 404 });
  if (orig.type === "storno") return NextResponse.json({ error: "Storno kann nicht erneut storniert werden" }, { status: 400 });
  const [{ value: seq }] = await db.select({ value: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.tenant_id, user.tenant_id));
  const [storno] = await db.insert(invoices).values({
    tenant_id: user.tenant_id, number: `${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`, type: "storno", status: "storno",
    customer_name: orig.customer_name, subtotal_cents: -orig.subtotal_cents, tax_cents: -orig.tax_cents, total_cents: -orig.total_cents,
    tax_rate_bp: orig.tax_rate_bp, storno_of_id: orig.id, tse_reference: `FISKALY-TSE-STORNO-${Date.now()}`,
  }).returning();
  await db.update(invoices).set({ status: "storno" }).where(eq(invoices.id, orig.id));
  await audit(user.id, user.tenant_id, "invoice.storno", "invoice", orig.id, { status: orig.status }, { storno: storno.id });
  return NextResponse.json({ ok: true, storno });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { tenants, products, invoices, invoice_items, transactions, notifications } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireUser, audit } from "@/lib/auth";
import { calcSplit, resolveCommission } from "@/lib/commission";

export const dynamic = "force-dynamic";
const Item = z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(999) });
const Body = z.object({
  items: z.array(Item).min(1), method: z.enum(["cash", "card", "terminal", "online", "sepa", "paypal", "klarna"]),
  customer_name: z.string().max(200).optional(), project_id: z.string().uuid().optional(),
});

// POS checkout: creates GoBD invoice (sequential per tenant) + transaction with frozen commission snapshot.
// Cash → TSE reference (Fiskaly). Card/terminal/online → Stripe Connect split (simulated here, Stripe keys via env).
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const tid = user.tenant_id;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
  if (!tenant) return NextResponse.json({ error: "Tenant nicht gefunden" }, { status: 404 });
  if (tenant.status === "suspended") return NextResponse.json({ error: "Konto gesperrt — bitte Abonnement prüfen." }, { status: 403 });

  let gross = 0;
  const lines: { name: string; qty: number; unit: number; total: number; id: string }[] = [];
  for (const it of parsed.data.items) {
    const [p] = await db.select().from(products).where(and(eq(products.id, it.product_id), eq(products.tenant_id, tid))).limit(1);
    if (!p) return NextResponse.json({ error: "Produkt gehört nicht zu Ihrem Geschäft (IDOR-Schutz)." }, { status: 403 });
    if (p.stock < it.quantity) return NextResponse.json({ error: `Nicht genügend Lager: ${p.name}` }, { status: 400 });
    gross += p.price_cents * it.quantity;
    lines.push({ name: p.name, qty: it.quantity, unit: p.price_cents, total: p.price_cents * it.quantity, id: p.id });
  }

  const comm = resolveCommission({ tenant: { percentBp: tenant.commission_percent ?? 500, fixedCents: tenant.commission_fixed_cents ?? 30, taxRateBp: tenant.tax_rate_bp ?? 1900 } });
  const split = calcSplit({ grossCents: gross, percentBp: comm.percentBp, fixedCents: comm.fixedCents, taxRateBp: comm.taxRateBp });

  // Sequential invoice number per tenant (GoBD)
  const [{ value: seq }] = await db.select({ value: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.tenant_id, tid));
  const number = `${new Date().getFullYear()}-${String(seq + 1).padStart(4, "0")}`;
  const tseRef = parsed.data.method === "cash" ? `FISKALY-TSE-${tenant.tse_serial ?? "DEMO"}-${Date.now()}` : null;

  const [inv] = await db.insert(invoices).values({
    tenant_id: tid, number, type: "invoice", status: "paid", customer_name: parsed.data.customer_name ?? "Barverkauf",
    subtotal_cents: gross - split.taxCents, tax_cents: split.taxCents, total_cents: gross, tax_rate_bp: comm.taxRateBp, tse_reference: tseRef,
  }).returning();
  for (const l of lines) {
    await db.insert(invoice_items).values({ invoice_id: inv.id, tenant_id: tid, name: l.name, quantity: l.qty, unit_price_cents: l.unit, total_cents: l.total });
    await db.update(products).set({ stock: sql`${products.stock} - ${l.qty}` }).where(eq(products.id, l.id));
  }
  const [tx] = await db.insert(transactions).values({
    tenant_id: tid, invoice_id: inv.id, project_id: parsed.data.project_id ?? null, amount_cents: gross, tax_cents: split.taxCents,
    commission_cents: split.commissionCents, net_cents: split.netCents, method: parsed.data.method, status: "completed",
    commission_snapshot: { percentBp: comm.percentBp, fixedCents: comm.fixedCents, taxRateBp: comm.taxRateBp, source: comm.source, grossCents: gross },
    stripe_payment_intent: parsed.data.method === "cash" ? null : `pi_demo_${Date.now()}`,
  }).returning();
  await db.insert(notifications).values({ tenant_id: tid, title: "Verkauf abgeschlossen", body: `${number} · ${(gross / 100).toFixed(2)}€ · ${parsed.data.method}`, type: "sale" });
  await audit(user.id, tid, "pos.checkout", "transaction", tx.id, null, { invoice: number, gross, method: parsed.data.method, tse: tseRef });
  return NextResponse.json({ ok: true, invoice: inv, transaction: tx, split, tse_reference: tseRef });
}

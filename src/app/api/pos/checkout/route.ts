import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, invoices, invoice_items, transactions, notifications } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError, nextInvoiceNumber } from "@/lib/guard";
import { calcSplit, resolveCommission } from "@/lib/commission";
import { clientIp, MAX_CENTS, readJson } from "@/lib/security";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const Body = z.object({
  items: z.array(z.object({ product_id: z.string().uuid(), quantity: z.number().int().min(1).max(999) })).min(1).max(100),
  method: z.enum(["cash", "card", "terminal", "online"]),
  customer_name: z.string().trim().max(200).optional(),
}).strict();

export async function GET() {
  // Rates needed for the client-side preview (never trusted for the actual booking)
  const ctx = await apiTenant("pos:use");
  if (ctx instanceof NextResponse) return ctx;
  const t = ctx.tenant;
  return NextResponse.json({ tax_rate_bp: t.tax_rate_bp ?? 1900, commission_percent: t.commission_percent ?? 500, commission_fixed_cents: t.commission_fixed_cents ?? 30, status: t.status });
}

class CheckoutError extends Error {}

// POS checkout: GoBD invoice (sequential per tenant) + transaction with frozen commission snapshot.
// Everything happens in one DB transaction; stock is decremented atomically (no overselling).
export async function POST(req: NextRequest) {
  const ctx = await apiTenant("pos:use", { write: true });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const { tenant, user } = ctx;
  const tid = tenant.id;

  // merge duplicate lines
  const qtyById = new Map<string, number>();
  for (const it of parsed.data.items) qtyById.set(it.product_id, (qtyById.get(it.product_id) ?? 0) + it.quantity);

  const comm = resolveCommission({ tenant: { percentBp: tenant.commission_percent ?? 500, fixedCents: tenant.commission_fixed_cents ?? 30, taxRateBp: tenant.tax_rate_bp ?? 1900 } });

  try {
    const out = await db.transaction(async (tx) => {
      const lines: { id: string; name: string; qty: number; unit: number; total: number }[] = [];
      for (const [id, qty] of qtyById) {
        const [p] = await tx.update(products).set({ stock: sql`${products.stock} - ${qty}` })
          .where(and(eq(products.id, id), eq(products.tenant_id, tid), eq(products.is_active, true), gte(products.stock, qty)))
          .returning({ id: products.id, name: products.name, price: products.price_cents });
        if (!p) {
          const [exists] = await tx.select({ id: products.id }).from(products).where(and(eq(products.id, id), eq(products.tenant_id, tid))).limit(1);
          throw new CheckoutError(exists ? "INSUFFICIENT_STOCK" : "NOT_FOUND");
        }
        lines.push({ id: p.id, name: p.name, qty, unit: p.price, total: p.price * qty });
      }
      const gross = lines.reduce((s, l) => s + l.total, 0);
      if (gross > MAX_CENTS) throw new CheckoutError("INVALID_INPUT");
      const split = calcSplit({ grossCents: gross, percentBp: comm.percentBp, fixedCents: comm.fixedCents, taxRateBp: comm.taxRateBp });
      const number = await nextInvoiceNumber(tx, tid);
      // Cash → TSE signature (Fiskaly integration point). Card/terminal/online → Stripe Connect (integration point).
      const tseRef = parsed.data.method === "cash" ? `${tenant.tse_serial ?? "TSE-PENDING"}-${randomUUID().slice(0, 8)}` : null;
      const [inv] = await tx.insert(invoices).values({
        tenant_id: tid, number, type: "invoice", status: "paid", customer_name: parsed.data.customer_name || "Barverkauf",
        subtotal_cents: gross - split.taxCents, tax_cents: split.taxCents, total_cents: gross, tax_rate_bp: comm.taxRateBp, tse_reference: tseRef,
      }).returning();
      await tx.insert(invoice_items).values(lines.map((l) => ({ invoice_id: inv.id, tenant_id: tid, name: l.name, quantity: l.qty, unit_price_cents: l.unit, total_cents: l.total })));
      const [trx] = await tx.insert(transactions).values({
        tenant_id: tid, invoice_id: inv.id, amount_cents: gross, tax_cents: split.taxCents, commission_cents: split.commissionCents, net_cents: split.netCents,
        method: parsed.data.method, status: "completed",
        commission_snapshot: { percentBp: comm.percentBp, fixedCents: comm.fixedCents, taxRateBp: comm.taxRateBp, source: comm.source, grossCents: gross },
      }).returning();
      await tx.insert(notifications).values({ tenant_id: tid, title: "Verkauf abgeschlossen", body: `${number} · ${(gross / 100).toFixed(2)} €`, type: "sale" });
      return { inv, trx, split, lines, tseRef };
    });
    await audit(user.id, tid, "pos.checkout", "transaction", out.trx.id, null, { invoice: out.inv.number, gross: out.split.grossCents, method: parsed.data.method }, clientIp(req));
    return NextResponse.json({ ok: true, invoice: { id: out.inv.id, number: out.inv.number, total_cents: out.inv.total_cents }, split: out.split, lines: out.lines, tse_reference: out.tseRef });
  } catch (e) {
    if (e instanceof CheckoutError) return jsonError(e.message, e.message === "NOT_FOUND" ? 404 : 409);
    throw e;
  }
}

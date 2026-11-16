import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invoices, invoice_items, transactions } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError, nextInvoiceNumber } from "@/lib/guard";
import { centsSchema, clientIp, MAX_CENTS, readJson, taxRateSchema } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await apiTenant("invoices:read");
  if (ctx instanceof NextResponse) return ctx;
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    if (!z.string().uuid().safeParse(id).success) return jsonError("INVALID_INPUT", 400);
    const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenant_id, ctx.tenant.id))).limit(1);
    if (!inv) return jsonError("NOT_FOUND", 404);
    const items = await db.select().from(invoice_items).where(and(eq(invoice_items.invoice_id, inv.id), eq(invoice_items.tenant_id, ctx.tenant.id)));
    const t = ctx.tenant;
    return NextResponse.json({ invoice: inv, items, business: { name: t.name, ust_idnr: t.ust_idnr, steuernummer: t.steuernummer, tse_serial: t.tse_serial } });
  }
  const rows = await db.select().from(invoices).where(eq(invoices.tenant_id, ctx.tenant.id)).orderBy(desc(invoices.issued_at), desc(invoices.number)).limit(300);
  return NextResponse.json(rows);
}

const Body = z.object({
  customer_name: z.string().trim().min(1).max(200),
  customer_email: z.string().trim().email().max(254).optional().or(z.literal("").transform(() => undefined)),
  items: z.array(z.object({ name: z.string().trim().min(1).max(200), quantity: z.number().int().min(1).max(10_000), unit_price_cents: centsSchema })).min(1).max(100),
  tax_rate_bp: taxRateSchema.default(1900),
}).strict();

// Create invoice (GoBD: never edited/deleted after issue — corrections via Storno)
export async function POST(req: NextRequest) {
  const ctx = await apiTenant("invoices:write", { write: true, module: "invoices" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const d = parsed.data;
  const gross = d.items.reduce((s, i) => s + i.quantity * i.unit_price_cents, 0);
  if (gross > MAX_CENTS) return jsonError("INVALID_INPUT", 400);
  const tax = Math.round((gross * d.tax_rate_bp) / (10000 + d.tax_rate_bp));
  const tid = ctx.tenant.id;
  const inv = await db.transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, tid);
    const [row] = await tx.insert(invoices).values({
      tenant_id: tid, number, type: "invoice", status: "issued", customer_name: d.customer_name, customer_email: d.customer_email,
      subtotal_cents: gross - tax, tax_cents: tax, total_cents: gross, tax_rate_bp: d.tax_rate_bp,
    }).returning();
    await tx.insert(invoice_items).values(d.items.map((i) => ({ invoice_id: row.id, tenant_id: tid, name: i.name, quantity: i.quantity, unit_price_cents: i.unit_price_cents, total_cents: i.quantity * i.unit_price_cents })));
    return row;
  });
  await audit(ctx.user.id, tid, "invoice.create", "invoice", inv.id, null, { number: inv.number, total_cents: inv.total_cents }, clientIp(req));
  return NextResponse.json({ ok: true, invoice: inv });
}

const Patch = z.object({ invoice_id: z.string().uuid() }).strict();

// Storno: creates a cancelling invoice linked to the original (GoBD-compliant) and reverses the payment split.
export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("invoices:write", { write: true, module: "invoices" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Patch.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const tid = ctx.tenant.id;
  const result = await db.transaction(async (tx) => {
    const [orig] = await tx.select().from(invoices).where(and(eq(invoices.id, parsed.data.invoice_id), eq(invoices.tenant_id, tid))).for("update").limit(1);
    if (!orig) return "NOT_FOUND" as const;
    if (orig.type === "storno" || orig.status === "storno") return "ALREADY_STORNO" as const;
    const number = await nextInvoiceNumber(tx, tid);
    const [storno] = await tx.insert(invoices).values({
      tenant_id: tid, number, type: "storno", status: "storno", customer_name: orig.customer_name, customer_email: orig.customer_email,
      subtotal_cents: -orig.subtotal_cents, tax_cents: -orig.tax_cents, total_cents: -orig.total_cents, tax_rate_bp: orig.tax_rate_bp, storno_of_id: orig.id,
      tse_reference: orig.tse_reference ? `STORNO-${orig.tse_reference}` : null,
    }).returning();
    const items = await tx.select().from(invoice_items).where(and(eq(invoice_items.invoice_id, orig.id), eq(invoice_items.tenant_id, tid)));
    if (items.length) await tx.insert(invoice_items).values(items.map((i) => ({ invoice_id: storno.id, tenant_id: tid, name: i.name, quantity: -i.quantity, unit_price_cents: i.unit_price_cents, total_cents: -i.total_cents })));
    const [origTx] = await tx.select().from(transactions).where(and(eq(transactions.invoice_id, orig.id), eq(transactions.tenant_id, tid))).limit(1);
    if (origTx) {
      await tx.insert(transactions).values({
        tenant_id: tid, invoice_id: storno.id, amount_cents: -origTx.amount_cents, tax_cents: -origTx.tax_cents, commission_cents: -origTx.commission_cents,
        net_cents: -origTx.net_cents, method: origTx.method, status: "reversed", commission_snapshot: origTx.commission_snapshot,
      });
    }
    await tx.update(invoices).set({ status: "storno" }).where(eq(invoices.id, orig.id));
    return { orig, storno };
  });
  if (typeof result === "string") return jsonError(result, result === "NOT_FOUND" ? 404 : 400);
  await audit(ctx.user.id, tid, "invoice.storno", "invoice", result.orig.id, { status: result.orig.status }, { storno: result.storno.number }, clientIp(req));
  return NextResponse.json({ ok: true, storno: result.storno });
}

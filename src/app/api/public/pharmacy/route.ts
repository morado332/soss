import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import { db } from "@/db";
import { tenants, products, orders, notifications } from "@/db/schema";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, readJson } from "@/lib/security";
import { jsonError, tenantModules } from "@/lib/guard";
import { stripeConfigured, stripeRequest } from "@/core/stripe";
import { pickupHours, reservationFee, type ReservationItem } from "@/modules/pharmacy/service";

export const dynamic = "force-dynamic";

async function pharmacy(slug: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const [t] = await db.select().from(tenants).where(and(eq(tenants.slug, slug), inArray(tenants.status, ["active", "trial", "past_due"]))).limit(1);
  if (!t || !(await tenantModules(t)).has("pharmacy")) return null;
  return t;
}

// Public medicine search (only items the pharmacy marked as reservable). Stock is shown as available yes/no only.
export async function GET(req: NextRequest) {
  if (!rateLimit(`ph-search:${clientIp(req)}`, 120, 10 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const t = await pharmacy(req.nextUrl.searchParams.get("slug") ?? "");
  if (!t) return jsonError("NOT_FOUND", 404);
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60).replace(/[%_\\]/g, "\\$&");
  const rows = await db.select({ id: products.id, name: products.name, price_cents: products.price_cents, rx: products.rx_required, available: sql<boolean>`${products.stock} > 0` })
    .from(products).where(and(eq(products.tenant_id, t.id), eq(products.is_active, true), eq(products.reservable, true), q ? ilike(products.name, `%${q}%`) : undefined))
    .orderBy(asc(products.name)).limit(40);
  const fee = reservationFee(t);
  return NextResponse.json({ items: rows, fee_cents: fee, online_payment: fee > 0 && (await stripeConfigured()), hold_hours: pickupHours(t) });
}

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
  items: z.array(z.object({ product_id: z.string().uuid(), qty: z.number().int().min(1).max(5) }).strict()).min(1).max(10),
  customer_name: z.string().trim().min(2).max(120),
  customer_phone: z.string().trim().min(5).max(40).regex(/^[0-9+()\/\-\s]+$/),
  customer_email: z.string().trim().email().max(254).optional().or(z.literal("")),
  website: z.string().max(0).optional(), // honeypot
}).strict();

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!rateLimit(`ph-reserve:${ip}`, 6, 10 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const d = parsed.data;
  const t = await pharmacy(d.slug);
  if (!t) return jsonError("NOT_FOUND", 404);
  if (!rateLimit(`ph-reserve:tenant:${t.id}`, 100, 60 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const ids = [...new Set(d.items.map((i) => i.product_id))];
  if (ids.length !== d.items.length) return jsonError("INVALID_INPUT", 400);

  const pickup = randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
  const result = await db.transaction(async (tx) => {
    const rows = await tx.select().from(products).where(and(eq(products.tenant_id, t.id), inArray(products.id, ids), eq(products.is_active, true), eq(products.reservable, true))).for("update");
    if (rows.length !== ids.length) return { error: "NOT_FOUND" as const };
    const items: ReservationItem[] = [];
    for (const it of d.items) {
      const p = rows.find((r) => r.id === it.product_id)!;
      if (p.stock < it.qty) return { error: "INSUFFICIENT_STOCK" as const };
      items.push({ product_id: p.id, name: p.name, qty: it.qty, price_cents: p.price_cents, rx: p.rx_required });
      await tx.update(products).set({ stock: sql`${products.stock} - ${it.qty}` }).where(eq(products.id, p.id)); // hold the stock
    }
    const rx = items.some((i) => i.rx);
    // Prescription medicines are reserve-only: no online payment, the fee is never charged for them.
    const fee = rx ? 0 : reservationFee(t);
    const [o] = await tx.insert(orders).values({
      tenant_id: t.id, customer_name: d.customer_name, customer_phone: d.customer_phone, customer_email: d.customer_email || null, items,
      total_cents: items.reduce((s, i) => s + i.qty * i.price_cents, 0), status: "reserved", source: "reservation", requires_prescription: rx,
      reservation_fee_cents: fee, payment_status: fee > 0 ? "pending" : "none", pickup_code: pickup,
    }).returning();
    await tx.insert(notifications).values({ tenant_id: t.id, type: "reservation", title: "Neue Medikamenten-Reservierung", body: `${d.customer_name} · ${items.map((i) => `${i.qty}× ${i.name}`).join(", ").slice(0, 300)}${rx ? " · Rx" : ""}` });
    return { order: o, fee, rx };
  });
  if ("error" in result) return jsonError(result.error!, result.error === "NOT_FOUND" ? 404 : 409);

  let checkout_url: string | null = null;
  if (result.fee > 0) {
    try {
      const base = process.env.APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
      const s = await stripeRequest<{ id: string; url: string }>("POST", "/checkout/sessions", {
        mode: "payment", "line_items[0][quantity]": "1", "line_items[0][price_data][currency]": "eur",
        "line_items[0][price_data][unit_amount]": String(result.fee), "line_items[0][price_data][product_data][name]": `Reservierungsgebühr · ${t.name}`.slice(0, 120),
        "metadata[order_id]": result.order.id, "metadata[tenant_id]": t.id, client_reference_id: result.order.id,
        success_url: `${base}/r/${result.order.id}?paid=1`, cancel_url: `${base}/r/${result.order.id}`, expires_at: String(Math.floor(Date.now() / 1000) + 1800),
      }, { account: t.stripe_account_id ?? undefined, idempotencyKey: randomUUID() });
      await db.update(orders).set({ stripe_session_id: s.id }).where(eq(orders.id, result.order.id));
      checkout_url = s.url;
    } catch {
      // Stripe not configured / unreachable: the reservation stays valid, the fee is paid at pickup.
      await db.update(orders).set({ payment_status: "at_pickup" }).where(eq(orders.id, result.order.id));
    }
  }
  return NextResponse.json({ ok: true, order_id: result.order.id, pickup_code: pickup, rx: result.rx, fee_cents: result.fee, checkout_url, hold_hours: pickupHours(t) });
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getPaymentConfig } from "@/core/platform";
import { decryptSecret } from "@/core/secrets";
import { verifyStripeSignature } from "@/core/stripe";

export const dynamic = "force-dynamic";

// Stripe → us. Signature verified with the webhook secret stored (encrypted) by the Root. No session/CSRF: server-to-server.
export async function POST(req: NextRequest) {
  const secret = decryptSecret((await getPaymentConfig()).stripeWebhookSecret);
  if (!secret) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const payload = await req.text();
  if (payload.length > 512_000 || !verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "BAD_SIGNATURE" }, { status: 400 });
  let ev: { type?: string; data?: { object?: { id?: string; payment_status?: string; metadata?: Record<string, string> } } };
  try { ev = JSON.parse(payload); } catch { return NextResponse.json({ error: "BAD_JSON" }, { status: 400 }); }
  const obj = ev.data?.object;
  const orderId = obj?.metadata?.order_id;
  if (orderId && obj?.id && /^[0-9a-f-]{36}$/.test(orderId)) {
    // session id must match the one we created for this order → metadata alone can't mark foreign orders paid
    const where = and(eq(orders.id, orderId), eq(orders.stripe_session_id, obj.id));
    if (ev.type === "checkout.session.completed" && obj.payment_status === "paid") await db.update(orders).set({ payment_status: "paid" }).where(where);
    if (ev.type === "checkout.session.expired") await db.update(orders).set({ payment_status: "failed" }).where(where);
  }
  return NextResponse.json({ received: true });
}

import { NextResponse } from "next/server";
import { apiRoot, jsonError } from "@/lib/guard";
import { rateLimit } from "@/lib/ratelimit";
import { stripeRequest } from "@/core/stripe";

export const dynamic = "force-dynamic";

// Checks the stored Stripe key against the Stripe API (read-only call).
export async function POST() {
  const user = await apiRoot("platform:payments");
  if (user instanceof NextResponse) return user;
  if (!rateLimit(`stripe-test:${user.id}`, 10, 10 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  try {
    const acct = await stripeRequest<{ id: string; country?: string; charges_enabled?: boolean; settings?: { dashboard?: { display_name?: string } } }>("GET", "/account");
    return NextResponse.json({ ok: true, account: acct.id, name: acct.settings?.dashboard?.display_name ?? null, country: acct.country ?? null, charges_enabled: acct.charges_enabled ?? null });
  } catch (e) {
    const msg = String((e as Error).message);
    return jsonError(msg === "STRIPE_NOT_CONFIGURED" ? "STRIPE_NOT_CONFIGURED" : "STRIPE_ERROR", 400, { detail: msg.replace(/^STRIPE_ERROR: /, "").slice(0, 200) });
  }
}

import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { decryptSecret } from "./secrets";
import { getPaymentConfig } from "./platform";

/** Minimal Stripe REST client (form-encoded), using the platform secret key stored encrypted by the Root. */
export async function stripeRequest<T = Record<string, unknown>>(method: "GET" | "POST", path: string, params?: Record<string, string>, opts: { account?: string; idempotencyKey?: string } = {}): Promise<T> {
  const cfg = await getPaymentConfig();
  const key = decryptSecret(cfg.stripeSecret);
  if (!key) throw new Error("STRIPE_NOT_CONFIGURED");
  const body = params ? new URLSearchParams(params).toString() : undefined;
  const r = await fetch(`https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded",
      ...(opts.account ? { "Stripe-Account": opts.account } : {}),
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await r.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!r.ok) throw new Error(`STRIPE_ERROR: ${json.error?.message ?? r.status}`);
  return json;
}

export async function stripeConfigured() {
  return !!decryptSecret((await getPaymentConfig()).stripeSecret);
}

/** Verifies a Stripe webhook signature header (t=…,v1=…) with a 5-minute tolerance. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest();
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => Buffer.from(p.slice(3), "hex"));
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(s, expected));
}

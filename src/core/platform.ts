import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platform_settings } from "@/db/schema";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const [row] = await db.select().from(platform_settings).where(eq(platform_settings.key, key)).limit(1);
    return (row?.value as T) ?? fallback;
  } catch {
    return fallback; // database not ready yet (e.g. /status page)
  }
}

export async function setSetting(key: string, value: unknown) {
  await db.insert(platform_settings).values({ key, value: value as never })
    .onConflictDoUpdate({ target: platform_settings.key, set: { value: value as never, updated_at: new Date() } });
  if (key === "branding") brandingCache = null;
}

// ---------------------------------------------------------------- Branding (editable by Root)
export type Branding = {
  siteName: string; tagline: string; logo: string | null; accent: string;
  contactEmail: string; contactPhone: string; address: string; footer: string;
  showIndustries: boolean; showModules: boolean; showCompliance: boolean; showPricing: boolean;
  plans: { name: string; price: number }[];
};
export const DEFAULT_BRANDING: Branding = {
  siteName: "Arena", tagline: "", logo: null, accent: "indigo",
  contactEmail: "", contactPhone: "", address: "", footer: "",
  showIndustries: true, showModules: true, showCompliance: true, showPricing: true,
  plans: [{ name: "Starter", price: 29 }, { name: "Pro", price: 49 }, { name: "Business", price: 79 }],
};

let brandingCache: { at: number; value: Branding } | null = null;
export async function getBranding(): Promise<Branding> {
  if (brandingCache && Date.now() - brandingCache.at < 30_000) return brandingCache.value;
  const value = { ...DEFAULT_BRANDING, ...(await getSetting<Partial<Branding>>("branding", {})) };
  brandingCache = { at: Date.now(), value };
  return value;
}

// ---------------------------------------------------------------- Payment provider configuration (platform level)
export type PaymentConfig = {
  stripePublishable: string;
  stripeSecret: string | null;        // encrypted
  stripeWebhookSecret: string | null; // encrypted
  sumupApiKey: string | null;         // encrypted
  currency: string;
};
export const DEFAULT_PAYMENTS: PaymentConfig = { stripePublishable: "", stripeSecret: null, stripeWebhookSecret: null, sumupApiKey: null, currency: "eur" };
export async function getPaymentConfig(): Promise<PaymentConfig> {
  return { ...DEFAULT_PAYMENTS, ...(await getSetting<Partial<PaymentConfig>>("payments", {})) };
}

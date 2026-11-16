import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Encrypts secrets (Stripe/SumUp keys) before they are stored in the database (AES-256-GCM).
 * Key: APP_SECRET (recommended) or, as a fallback, derived from DATABASE_URL — so a leaked
 * database dump or backup alone never reveals payment keys.
 */
function key(): Buffer {
  const material = process.env.APP_SECRET || process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
  if (!material) throw new Error("No key material for secret encryption");
  return createHash("sha256").update("arena-secrets-v1|" + material).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored || !stored.startsWith("v1:")) return null;
  try {
    const buf = Buffer.from(stored.slice(3), "base64");
    const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "sk_live_…abcd" → "sk_live_••••abcd" (for display only). */
export const maskSecret = (s: string | null) => (s ? `${s.slice(0, 8)}••••${s.slice(-4)}` : null);

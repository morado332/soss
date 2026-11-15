import type { NextRequest } from "next/server";
import { z } from "zod";

/** Best-effort client IP (first hop of X-Forwarded-For set by the reverse proxy). */
export function clientIp(req: NextRequest | Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const ip = xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}

/** Escape a value for XML text/attribute content. */
export function xmlEscape(v: unknown): string {
  return String(v ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

/** Make a value safe for a semicolon CSV cell (prevents formula injection & delimiter breaking). */
export function csvCell(v: unknown): string {
  let s = String(v ?? "").replace(/[\r\n]+/g, " ");
  if (/^[=+\-@\t]/.test(s)) s = "'" + s;
  if (/[;"]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Strong password policy shared by setup, tenant creation and password change. */
export const passwordSchema = z
  .string()
  .min(10, "min10")
  .max(72, "max72") // bcrypt only uses the first 72 bytes
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), "weak");

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Upper bound for money amounts (cents) to stay well inside int4. */
export const MAX_CENTS = 100_000_000; // 1.000.000,00 €
export const centsSchema = z.number().int().min(0).max(MAX_CENTS);
export const taxRateSchema = z.union([z.literal(0), z.literal(700), z.literal(1900)]);

export async function readJson(req: NextRequest | Request): Promise<unknown> {
  try { return await req.json(); } catch { return null; }
}

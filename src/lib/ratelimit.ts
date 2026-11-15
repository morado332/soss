// Simple in-memory fixed-window rate limiter (per server process).
// For multi-instance deployments replace with Redis (REDIS_URL).
type Bucket = { count: number; resetAt: number };
const g = globalThis as typeof globalThis & { __arenaRate?: Map<string, Bucket> };
const buckets = (g.__arenaRate ??= new Map<string, Bucket>());

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  if (buckets.size > 50_000) for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

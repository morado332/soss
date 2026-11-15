import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tenants, services } from "@/db/schema";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp } from "@/lib/security";
import { jsonError } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!rateLimit(`pubinfo:${clientIp(req)}`, 120, 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").slice(0, 100);
  if (!/^[a-z0-9-]+$/.test(slug)) return jsonError("NOT_FOUND", 404);
  const [t] = await db.select({ id: tenants.id, name: tenants.name, profession: tenants.profession }).from(tenants)
    .where(and(eq(tenants.slug, slug), inArray(tenants.status, ["active", "trial", "past_due"]))).limit(1);
  if (!t) return jsonError("NOT_FOUND", 404);
  const svcs = await db.select({ id: services.id, name: services.name, duration_minutes: services.duration_minutes, price_cents: services.price_cents })
    .from(services).where(and(eq(services.tenant_id, t.id), eq(services.is_active, true))).orderBy(asc(services.name));
  return NextResponse.json({ business: t.name, profession: t.profession, services: svcs });
}

import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { tenantModules } from "@/lib/guard";
import { generateInsights } from "@/core/ai-insights";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const a = createHash("sha256").update(req.headers.get("authorization") ?? "").digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

// Daily/hourly: AI advisor insights for every active business.
async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  let created = 0;
  for (const t of await db.select().from(tenants).where(inArray(tenants.status, ["active", "trial", "past_due"]))) {
    try { created += await generateInsights(t, await tenantModules(t)); } catch (e) { console.error("[cron insights]", t.id, e); }
  }
  return NextResponse.json({ ok: true, created });
}
export const GET = run;
export const POST = run;

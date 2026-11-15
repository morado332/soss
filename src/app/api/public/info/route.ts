import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, services } from "@/db/schema";
import { eq } from "drizzle-orm";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const [t] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (!t) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const svcs = await db.select().from(services).where(eq(services.tenant_id, t.id));
  return NextResponse.json({ business: t.name, profession: t.profession, services: svcs });
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const rows = await db.select().from(products).where(eq(products.tenant_id, user.tenant_id)).orderBy(products.name);
  return NextResponse.json(rows);
}

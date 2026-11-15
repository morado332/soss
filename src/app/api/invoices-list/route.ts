import { NextResponse } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json([], { status: 401 });
  return NextResponse.json(await db.select().from(invoices).where(eq(invoices.tenant_id, user.tenant_id)).orderBy(desc(invoices.issued_at)).limit(100));
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { services } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json([], { status: 401 });
  return NextResponse.json(await db.select().from(services).where(eq(services.tenant_id, user.tenant_id)));
}

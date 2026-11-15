import { NextResponse } from "next/server";
import { db } from "@/db";
import { queue_tickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json([], { status: 401 });
  return NextResponse.json(await db.select().from(queue_tickets).where(eq(queue_tickets.tenant_id, user.tenant_id)).orderBy(queue_tickets.number));
}

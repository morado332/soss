import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, transactions } from "@/db/schema";
import { sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user || (user.role !== "root" && user.role !== "super_admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const all = await db.select().from(tenants);
  const [rev] = await db.select({ v: sql<number>`coalesce(sum(amount_cents),0)::int` }).from(transactions);
  const [comm] = await db.select({ v: sql<number>`coalesce(sum(commission_cents),0)::int` }).from(transactions);
  return NextResponse.json({
    tenants: all.length, revenue: rev.v, commissions: comm.v,
    pastDue: all.filter((t) => t.status === "past_due").length, suspended: all.filter((t) => t.status === "suspended").length,
  });
}

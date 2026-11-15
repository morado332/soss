import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, transactions } from "@/db/schema";
import { apiRoot } from "@/lib/guard";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await apiRoot();
  if (user instanceof NextResponse) return user;
  const [t] = await db.select({
    total: sql<number>`count(*)::int`,
    pastDue: sql<number>`count(*) filter (where status = 'past_due')::int`,
    suspended: sql<number>`count(*) filter (where status = 'suspended')::int`,
    mrr: sql<number>`coalesce(sum(monthly_fee_cents) filter (where status in ('active','past_due')),0)::int`,
  }).from(tenants);
  const [tx] = await db.select({ revenue: sql<number>`coalesce(sum(amount_cents),0)::bigint`, commissions: sql<number>`coalesce(sum(commission_cents),0)::bigint` }).from(transactions);
  return NextResponse.json({ tenants: t.total, pastDue: t.pastDue, suspended: t.suspended, mrr: t.mrr, revenue: Number(tx.revenue), commissions: Number(tx.commissions) });
}

import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { transactions } from "@/db/schema";

export const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); };

export async function monthTotals(tid: string, from = monthStart(), to?: Date) {
  const conds = [eq(transactions.tenant_id, tid), gte(transactions.created_at, from)];
  if (to) conds.push(sql`${transactions.created_at} < ${to}`);
  const [r] = await db.select({
    gross: sql<number>`coalesce(sum(amount_cents),0)::int`, tax: sql<number>`coalesce(sum(tax_cents),0)::int`,
    fee: sql<number>`coalesce(sum(commission_cents),0)::int`, net: sql<number>`coalesce(sum(net_cents),0)::int`,
    count: sql<number>`count(*) filter (where status = 'completed')::int`,
  }).from(transactions).where(and(...conds));
  return r;
}

/** Daily gross revenue for the last `days` days (zero-filled). */
export async function dailyRevenue(tid: string, days = 14) {
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1));
  const rows = await db.select({ day: sql<string>`to_char(date_trunc('day', ${transactions.created_at}), 'YYYY-MM-DD')`, cents: sql<number>`sum(amount_cents)::int` })
    .from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, from))).groupBy(sql`1`);
  const map = new Map(rows.map((r) => [r.day, r.cents]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(from); d.setDate(from.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { day: key, cents: map.get(key) ?? 0 };
  });
}
export const serverNow = () => Date.now();

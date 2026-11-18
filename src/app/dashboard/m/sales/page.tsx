import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Banknote, CreditCard, ShoppingBag, Receipt } from "lucide-react";
import { serverNow } from "@/lib/stats";
import { db } from "@/db";
import { transactions, invoices } from "@/db/schema";
import { requireModulePage } from "@/lib/module-page";
import { getI18n } from "@/lib/i18n-server";
import { eur } from "@/lib/commission";
import { Badge, Card, Empty, PageHeader, Stat, Table, cx, tdCls, thCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Sales journal of the last 30 days (store POS + invoices), with totals per day and payment method.
export default async function SalesPage() {
  const { tenant } = await requireModulePage("reports:read", ["sales"]);
  const { t, locale } = await getI18n();
  const from = new Date(serverNow() - 30 * 86_400_000);
  const rows = await db.select({ id: transactions.id, amount: transactions.amount_cents, method: transactions.method, status: transactions.status, created_at: transactions.created_at, number: invoices.number, customer: invoices.customer_name })
    .from(transactions).leftJoin(invoices, and(eq(transactions.invoice_id, invoices.id), eq(invoices.tenant_id, tenant.id)))
    .where(and(eq(transactions.tenant_id, tenant.id), gte(transactions.created_at, from))).orderBy(desc(transactions.created_at)).limit(500);
  const days = await db.select({ d: sql<string>`to_char(${transactions.created_at}, 'YYYY-MM-DD')`, v: sql<number>`sum(${transactions.amount_cents})::int`, n: sql<number>`count(*)::int` })
    .from(transactions).where(and(eq(transactions.tenant_id, tenant.id), gte(transactions.created_at, from))).groupBy(sql`1`).orderBy(sql`1 desc`).limit(10);
  const money = (c: number) => eur(c, locale);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const by = (m: string) => rows.filter((r) => r.method === m).reduce((s, r) => s + r.amount, 0);
  const count = rows.filter((r) => r.amount > 0).length;
  const max = Math.max(1, ...days.map((d) => d.v));
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_sales")} description={t("sa_sub")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("sa_total")} value={money(total)} icon={Receipt} />
        <Stat label={t("sa_count")} value={String(count)} icon={ShoppingBag} tone="sky" sub={count ? `Ø ${money(Math.round(total / count))}` : undefined} />
        <Stat label={t("o_cash")} value={money(by("cash"))} icon={Banknote} tone="emerald" />
        <Stat label={t("o_card")} value={money(total - by("cash"))} icon={CreditCard} tone="amber" />
      </div>
      <Card title={t("sa_days")}>
        {days.length === 0 ? <Empty icon={ShoppingBag} text={t("biz_empty")} /> : <ul className="space-y-2">{days.map((d) => (
          <li key={d.d} className="flex items-center gap-3 text-sm"><span className="w-28 shrink-0">{new Date(`${d.d}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
            <span className="h-2.5 flex-1 rounded-full bg-slate-100 dark:bg-slate-800"><span className="block h-2.5 rounded-full bg-indigo-500" style={{ width: `${Math.round((d.v / max) * 100)}%` }} /></span>
            <span className="tabular w-28 text-end font-medium">{money(d.v)}</span><span className="w-12 text-end text-xs text-slate-500">{d.n}×</span></li>))}</ul>}
      </Card>
      <Card padded={false} title={t("sa_journal")}>
        {rows.length === 0 ? <div className="p-5"><Empty icon={Receipt} text={t("biz_empty")} /></div> : (
          <Table head={<><th className={thCls}>{t("f_date")}</th><th className={thCls}>{t("nav_invoices")}</th><th className={thCls}>{t("f_customer")}</th><th className={thCls}>{t("f_method")}</th><th className={thCls}>{t("f_amount")}</th></>}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={tdCls}>{new Date(r.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</td>
                <td className={cx(tdCls, "font-mono text-xs")}>{r.number ?? "—"}</td>
                <td className={tdCls}>{r.customer ?? "—"}</td>
                <td className={tdCls}><Badge tone={r.method === "cash" ? "green" : "blue"}>{t(`o_${r.method}` as DictKey)}</Badge></td>
                <td className={cx(tdCls, "tabular font-semibold", r.amount < 0 && "text-rose-600")}>{money(r.amount)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

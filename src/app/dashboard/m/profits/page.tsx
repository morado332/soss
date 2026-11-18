import { sql } from "drizzle-orm";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Receipt } from "lucide-react";
import { db } from "@/db";
import { requireModulePage } from "@/lib/module-page";
import { getI18n } from "@/lib/i18n-server";
import { eur } from "@/lib/commission";
import { Card, PageHeader, Stat, Table, cx, tdCls, thCls } from "@/components/ui";

export const dynamic = "force-dynamic";

type M = { m: string; revenue: number; cogs: number; fees: number; expenses: number; income: number };

// Profit & loss per month: net revenue (excl. VAT, cancellations netted) − cost of goods − platform fees − expenses + other income.
export default async function ProfitsPage() {
  const { tenant } = await requireModulePage("finance:read", ["profits"]);
  const { t, locale } = await getI18n();
  const tid = tenant.id;
  const r = await db.execute<M>(sql`
    with months as (select to_char(date_trunc('month', now()) - make_interval(months => g), 'YYYY-MM') m from generate_series(0, 5) g),
    rev as (select to_char(issued_at, 'YYYY-MM') m, sum(subtotal_cents)::bigint v from invoices where tenant_id = ${tid} and type in ('invoice','storno') group by 1),
    cogs as (select to_char(i.issued_at, 'YYYY-MM') m, sum(ii.quantity * coalesce((select p.cost_cents from products p where p.tenant_id = ${tid} and p.name = ii.name limit 1), 0))::bigint v
             from invoice_items ii join invoices i on i.id = ii.invoice_id and i.tenant_id = ${tid} where ii.tenant_id = ${tid} and i.type in ('invoice','storno') group by 1),
    fees as (select to_char(created_at, 'YYYY-MM') m, sum(commission_cents)::bigint v from transactions where tenant_id = ${tid} group by 1),
    ex as (select substr(data->>'date', 1, 7) m,
             sum(case when data->>'type' = 'expense' then (data->>'amount')::bigint else 0 end) e,
             sum(case when data->>'type' = 'income' then (data->>'amount')::bigint else 0 end) i
           from biz_records where tenant_id = ${tid} and kind = 'expenses' group by 1)
    select months.m, coalesce(rev.v,0)::bigint revenue, coalesce(cogs.v,0)::bigint cogs, coalesce(fees.v,0)::bigint fees, coalesce(ex.e,0)::bigint expenses, coalesce(ex.i,0)::bigint income
    from months left join rev using (m) left join cogs using (m) left join fees using (m) left join ex using (m) order by months.m desc`);
  const rows = r.rows.map((x) => ({ m: x.m, revenue: Number(x.revenue), cogs: Number(x.cogs), fees: Number(x.fees), expenses: Number(x.expenses), income: Number(x.income) }))
    .map((x) => ({ ...x, gross: x.revenue - x.cogs, net: x.revenue - x.cogs - x.fees - x.expenses + x.income }));
  const cur = rows[0], prev = rows[1];
  const money = (c: number) => eur(c, locale);
  const margin = cur.revenue > 0 ? Math.max(-999, Math.min(999, Math.round((cur.net / cur.revenue) * 100))) : 0;
  const label = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleDateString(locale, { month: "long", year: "numeric" });
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_profits")} description={t("pr_sub")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("pr_revenue")} value={money(cur.revenue)} icon={Receipt} sub={label(cur.m)} />
        <Stat label={t("pr_gross")} value={money(cur.gross)} icon={TrendingUp} tone="sky" />
        <Stat label={t("pr_costs")} value={money(cur.cogs + cur.fees + cur.expenses)} icon={Wallet} tone="amber" />
        <Stat label={t("pr_net")} value={money(cur.net)} icon={cur.net >= 0 ? PiggyBank : TrendingDown} tone={cur.net >= 0 ? "emerald" : "rose"}
          sub={`${t("pr_margin")} ${margin} % · ${prev ? `${cur.net >= prev.net ? "▲" : "▼"} ${money(Math.abs(cur.net - prev.net))}` : ""}`} />
      </div>
      <Card title={t("pr_table")} padded={false}>
        <Table head={<><th className={thCls}>{t("pr_month")}</th><th className={thCls}>{t("pr_revenue")}</th><th className={thCls}>{t("pr_cogs")}</th><th className={thCls}>{t("pr_gross")}</th><th className={thCls}>{t("pr_fees")}</th><th className={thCls}>{t("pr_expenses")}</th><th className={thCls}>{t("pr_income")}</th><th className={thCls}>{t("pr_net")}</th></>}>
          {rows.map((x) => (
            <tr key={x.m}>
              <td className={cx(tdCls, "font-medium")}>{label(x.m)}</td>
              <td className={cx(tdCls, "tabular")}>{money(x.revenue)}</td>
              <td className={cx(tdCls, "tabular text-slate-500")}>−{money(x.cogs)}</td>
              <td className={cx(tdCls, "tabular")}>{money(x.gross)}</td>
              <td className={cx(tdCls, "tabular text-slate-500")}>−{money(x.fees)}</td>
              <td className={cx(tdCls, "tabular text-slate-500")}>−{money(x.expenses)}</td>
              <td className={cx(tdCls, "tabular text-slate-500")}>+{money(x.income)}</td>
              <td className={cx(tdCls, "tabular font-semibold", x.net >= 0 ? "text-emerald-600" : "text-rose-600")}>{money(x.net)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <p className="text-xs text-slate-500">{t("pr_note")}</p>
    </div>
  );
}

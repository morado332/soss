import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Banknote, Landmark, Percent, Wallet } from "lucide-react";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { requireTenantPage } from "@/lib/page-guard";
import { eur, platformFeeInvoice } from "@/lib/commission";
import { getI18n } from "@/lib/i18n-server";
import { monthStart, monthTotals, dailyRevenue } from "@/lib/stats";
import { Card, Stat, Empty, Badge, PageHeader, Table, thCls, tdCls, cx } from "@/components/ui";
import { RevenueBars } from "@/components/revenue-bars";
import type { DictKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { tenant } = await requireTenantPage("reports:read", false, "reports");
  const { t, locale } = await getI18n();
  const money = (c: number) => eur(c, locale);
  const tid = tenant.id;
  const [totals, daily, byMethod, all] = await Promise.all([
    monthTotals(tid), dailyRevenue(tid, 14),
    db.select({ method: transactions.method, v: sql<number>`coalesce(sum(amount_cents),0)::int`, c: sql<number>`count(*)::int` }).from(transactions)
      .where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart()))).groupBy(transactions.method),
    db.select().from(transactions).where(eq(transactions.tenant_id, tid)).orderBy(desc(transactions.created_at)).limit(50),
  ]);
  const fee = platformFeeInvoice(totals.fee);
  return (
    <div className="space-y-6">
      <PageHeader title={t("r_title")} description={t("r_sub")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("pos_gross")} value={money(totals.gross)} icon={Banknote} />
        <Stat label={t("i_vat")} value={money(totals.tax)} icon={Landmark} tone="sky" />
        <Stat label={t("d_commission")} value={money(totals.fee)} icon={Percent} tone="rose" />
        <Stat label={t("d_net")} value={money(totals.net)} icon={Wallet} tone="emerald" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={t("r_last7")} className="xl:col-span-2"><RevenueBars data={daily} locale={locale} label={t("r_last7")} /></Card>
        <Card title={t("r_byMethod")}>
          {byMethod.length === 0 ? <Empty text={t("noData")} /> : (
            <ul className="space-y-3">
              {byMethod.map((m) => (
                <li key={m.method} className="flex items-center justify-between text-sm">
                  <span>{t(`m_${m.method}` as DictKey)} <span className="text-slate-400">({m.c}×)</span></span>
                  <span className="tabular font-semibold">{money(m.v)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="mb-3 text-sm font-semibold">{t("r_platformInvoice")}</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500"><dt>{t("r_feesTotal")}</dt><dd className="tabular">{money(fee.commission)}</dd></div>
              <div className="flex justify-between text-slate-500"><dt>{t("r_feeVat")}</dt><dd className="tabular">{money(fee.vat)}</dd></div>
              <div className="flex justify-between font-semibold"><dt>{t("r_invoiceTotal")}</dt><dd className="tabular">{money(fee.total)}</dd></div>
              <div className="flex justify-between pt-2 text-xs text-slate-500"><dt>{t("r_subscription")} ({tenant.plan})</dt><dd className="tabular">{money(tenant.monthly_fee_cents)}{t("perMonth")}</dd></div>
            </dl>
          </div>
        </Card>
      </div>
      <Card title={t("r_all")} padded={false}>
        {all.length === 0 ? <div className="p-5"><Empty text={t("noData")} /></div> : (
          <Table head={<><th className={thCls}>{t("date")}</th><th className={thCls}>{t("r_method")}</th><th className={cx(thCls, "text-end")}>{t("pos_gross")}</th><th className={cx(thCls, "text-end")}>{t("i_vat")}</th><th className={cx(thCls, "text-end")}>{t("d_commission")}</th><th className={cx(thCls, "text-end")}>{t("d_net")}</th></>}>
            {all.map((x) => (
              <tr key={x.id} className={x.amount_cents < 0 ? "text-red-600 dark:text-red-400" : ""}>
                <td className={cx(tdCls, "tabular")}>{new Date(x.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</td>
                <td className={tdCls}><Badge>{t(`m_${x.method}` as DictKey)}</Badge></td>
                <td className={cx(tdCls, "tabular text-end font-medium")}>{money(x.amount_cents)}</td>
                <td className={cx(tdCls, "tabular text-end")}>{money(x.tax_cents)}</td>
                <td className={cx(tdCls, "tabular text-end")}>{money(x.commission_cents)}</td>
                <td className={cx(tdCls, "tabular text-end font-medium")}>{money(x.net_cents)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

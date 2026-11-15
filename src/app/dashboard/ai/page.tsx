import { and, desc, eq, gte, sql } from "drizzle-orm";
import { TrendingUp, TrendingDown, Receipt, LineChart, Lightbulb, Package, Megaphone, Share2, Sun } from "lucide-react";
import { db } from "@/db";
import { products, invoice_items, invoices } from "@/db/schema";
import { requireTenantPage } from "@/lib/page-guard";
import { eur } from "@/lib/commission";
import { getI18n } from "@/lib/i18n-server";
import { monthTotals, serverNow } from "@/lib/stats";
import { Card, Stat, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

// AI advisor — deterministic insights computed from the tenant's own data only.
// Integration point for Claude (ANTHROPIC_API_KEY): send these aggregates, never raw customer data.
export default async function AiPage() {
  const { tenant } = await requireTenantPage("reports:read");
  const { t, locale } = await getI18n();
  const money = (c: number) => eur(c, locale);
  const tid = tenant.id;
  const now = serverNow();
  const d30 = new Date(now - 30 * 86_400_000), d60 = new Date(now - 60 * 86_400_000);
  const [last30, prev30] = await Promise.all([monthTotals(tid, d30), monthTotals(tid, d60, d30)]);
  const top = await db.select({ name: invoice_items.name, qty: sql<number>`sum(${invoice_items.quantity})::int`, rev: sql<number>`sum(${invoice_items.total_cents})::int` })
    .from(invoice_items).innerJoin(invoices, eq(invoice_items.invoice_id, invoices.id))
    .where(and(eq(invoice_items.tenant_id, tid), gte(invoices.issued_at, d30), eq(invoices.type, "invoice"), sql`${invoices.status} <> 'storno'`))
    .groupBy(invoice_items.name).orderBy(desc(sql`sum(${invoice_items.quantity})`)).limit(5);
  const low = await db.select({ name: products.name }).from(products).where(and(eq(products.tenant_id, tid), eq(products.is_active, true), sql`${products.stock} <= coalesce(${products.low_stock_threshold}, 5)`)).limit(8);

  const growth = prev30.gross > 0 ? Math.round(((last30.gross - prev30.gross) / prev30.gross) * 100) : 0;
  const avg = last30.count > 0 ? Math.round(last30.gross / last30.count) : 0;
  const trend = Math.max(-0.5, Math.min(0.5, growth / 100));
  const forecast = Math.round(last30.gross * (1 + trend / 2));
  const month = new Date().getMonth();
  const seasonal = month >= 5 && month <= 7 ? t("ai_summer") : month >= 10 || month <= 1 ? t("ai_winter") : t("ai_spring");

  const recs = [
    { icon: Package, text: low.length ? t("ai_reorder", { items: low.map((l) => l.name).join(", ") }) : t("ai_noReorder") },
    ...(top[0] ? [{ icon: Megaphone, text: t("ai_promo", { item: top[0].name }) }] : []),
    { icon: Share2, text: t("ai_booking") },
    { icon: Sun, text: seasonal },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("ai_title")} description={t("ai_sub")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("ai_month")} value={money(last30.gross)} sub={t("ai_vsPrev", { p: `${growth >= 0 ? "+" : ""}${growth} %` })} icon={growth >= 0 ? TrendingUp : TrendingDown} tone={growth >= 0 ? "emerald" : "rose"} />
        <Stat label={t("ai_tx")} value={String(last30.count)} sub={t("ai_avg", { v: money(avg) })} icon={Receipt} />
        <Stat label={t("ai_forecast")} value={money(forecast)} sub={t("ai_forecastSub")} icon={LineChart} tone="sky" />
        <Stat label={t("d_net")} value={money(last30.net)} icon={TrendingUp} tone="emerald" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("ai_top")} padded={false}>
          {top.length === 0 ? <div className="p-5"><Empty text={t("ai_noSales")} /></div> : (
            <ol className="divide-y divide-slate-100 dark:divide-slate-800">
              {top.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-xs font-semibold dark:bg-slate-800">{i + 1}</span>
                  <span className="flex-1 font-medium">{p.name}</span>
                  <span className="text-xs text-slate-500">{t("ai_sold", { n: p.qty })}</span>
                  <span className="tabular w-24 text-end font-semibold">{money(p.rev)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-500" />{t("ai_recs")}</span>}>
          <ul className="space-y-3">
            {recs.map((r, i) => (
              <li key={i} className="flex gap-3 rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
                <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" /><span>{r.text}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

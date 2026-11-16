import { requireRootPage } from "@/lib/page-guard";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Building2, Banknote, Percent, TriangleAlert, Ban, Repeat } from "lucide-react";
import { db } from "@/db";
import { tenants, transactions, audit_logs, users } from "@/db/schema";
import { eur } from "@/lib/commission";
import { hasPlatformPermission } from "@/lib/guard";
import { getI18n } from "@/lib/i18n-server";
import { professionByKey, professionName } from "@/lib/professions";
import { Badge, Card, Empty, PageHeader, Stat, statusTone } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function RootOverview() {
  const me = await requireRootPage();
  const canFin = hasPlatformPermission(me, "platform:finance"), canTen = hasPlatformPermission(me, "platform:tenants"), canAudit = hasPlatformPermission(me, "platform:audit");
  const { t, lang, locale } = await getI18n();
  const money = (c: number) => eur(c, locale);
  const [s] = !canFin ? [null] : await db.select({
    total: sql<number>`count(*)::int`, pastDue: sql<number>`count(*) filter (where status = 'past_due')::int`,
    suspended: sql<number>`count(*) filter (where status = 'suspended')::int`,
    mrr: sql<number>`coalesce(sum(monthly_fee_cents) filter (where status in ('active','past_due')),0)::int`,
  }).from(tenants);
  const [tx] = !canFin ? [null] : await db.select({ rev: sql<string>`coalesce(sum(amount_cents),0)::bigint`, fee: sql<string>`coalesce(sum(commission_cents),0)::bigint` }).from(transactions);
  const recent = !canTen ? [] : await db.select().from(tenants).orderBy(desc(tenants.created_at)).limit(6);
  const logs = !canAudit ? [] : await db.select({ id: audit_logs.id, action: audit_logs.action, created_at: audit_logs.created_at, actor: users.email })
    .from(audit_logs).leftJoin(users, eq(audit_logs.actor_id, users.id)).orderBy(desc(audit_logs.created_at)).limit(8);

  return (
    <div className="space-y-6">
      <PageHeader title={t("root_title")} description={t("root_sub")} actions={canTen && <Link href="/root/tenants" className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"><Building2 className="h-4 w-4" />{t("root_newTenant")}</Link>} />
      {s && tx && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label={t("root_tenants")} value={String(s.total)} icon={Building2} />
        <Stat label={t("root_mrr")} value={money(s.mrr)} icon={Repeat} tone="sky" />
        <Stat label={t("root_revenue")} value={money(Number(tx.rev))} icon={Banknote} tone="emerald" />
        <Stat label={t("root_commissions")} value={money(Number(tx.fee))} icon={Percent} tone="emerald" />
        <Stat label={t("root_pastDue")} value={String(s.pastDue)} icon={TriangleAlert} tone="amber" />
        <Stat label={t("root_suspended")} value={String(s.suspended)} icon={Ban} tone="rose" />
      </div>}
      <div className="grid gap-6 xl:grid-cols-2">
        {canTen && <Card title={t("root_recentTenants")} padded={false} action={<Link href="/root/tenants" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link>}>
          {recent.length === 0 ? <div className="p-5"><Empty icon={Building2} text={t("root_noTenants")} /></div> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recent.map((x) => { const p = professionByKey(x.profession); return (
                <li key={x.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-xl">{p.icon}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{x.name}</p><p className="text-xs text-slate-500">{professionName(p, lang)} · {new Date(x.created_at).toLocaleDateString(locale)}</p></div>
                  <Badge tone={statusTone(x.status)}>{t(`st_${x.status}` as DictKey)}</Badge>
                </li>); })}
            </ul>
          )}
        </Card>}
        {canAudit && <Card title={t("root_recentAudit")} padded={false} action={<Link href="/root/audit" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link>}>
          {logs.length === 0 ? <div className="p-5"><Empty text={t("root_noAudit")} /></div> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{l.action}</code>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{l.actor ?? "—"}</span>
                  <span className="tabular text-xs text-slate-400">{new Date(l.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>}
      </div>
    </div>
  );
}

import { and, desc, eq, gte } from "drizzle-orm";
import { UserX } from "lucide-react";
import { serverNow } from "@/lib/stats";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { requireModulePage } from "@/lib/module-page";
import { getI18n } from "@/lib/i18n-server";
import { Badge, Card, Empty, PageHeader, Stat, Table, cx, tdCls, thCls } from "@/components/ui";

export const dynamic = "force-dynamic";

// Patients who missed appointments (status "no show") in the last 6 months, with repeat offenders on top.
export default async function NoShowsPage() {
  const { tenant } = await requireModulePage("appointments:read", ["no_shows"]);
  const { t, locale } = await getI18n();
  const rows = await db.select({ id: appointments.id, name: appointments.customer_name, phone: appointments.customer_phone, email: appointments.customer_email, at: appointments.starts_at })
    .from(appointments).where(and(eq(appointments.tenant_id, tenant.id), eq(appointments.status, "no_show"), gte(appointments.starts_at, new Date(serverNow() - 182 * 86_400_000))))
    .orderBy(desc(appointments.starts_at)).limit(500);
  const per = new Map<string, { name: string; phone: string | null; n: number; last: Date }>();
  for (const r of rows) { const k = (r.email || r.phone || r.name).toLowerCase(); const x = per.get(k) ?? { name: r.name, phone: r.phone, n: 0, last: r.at }; x.n++; per.set(k, x); }
  const repeat = [...per.values()].sort((a, b) => b.n - a.n);
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_no_shows")} description={t("ns_sub")} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("ns_total")} value={String(rows.length)} icon={UserX} tone="rose" />
        <Stat label={t("ns_patients")} value={String(per.size)} icon={UserX} />
        <Stat label={t("ns_repeat")} value={String(repeat.filter((x) => x.n > 1).length)} icon={UserX} tone="amber" />
      </div>
      <Card padded={false}>
        {repeat.length === 0 ? <div className="p-5"><Empty icon={UserX} text={t("ns_none")} /></div> : (
          <Table head={<><th className={thCls}>{t("name")}</th><th className={thCls}>{t("f_phone")}</th><th className={thCls}>{t("ns_count")}</th><th className={thCls}>{t("ns_last")}</th></>}>
            {repeat.map((x) => (
              <tr key={x.name + x.last.toISOString()}>
                <td className={cx(tdCls, "font-medium")}>{x.name}</td>
                <td className={tdCls} dir="ltr">{x.phone ?? "—"}</td>
                <td className={tdCls}><Badge tone={x.n > 2 ? "red" : x.n > 1 ? "amber" : "slate"}>{x.n}×</Badge></td>
                <td className={tdCls}>{x.last.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

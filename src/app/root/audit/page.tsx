import { requireRootPage } from "@/lib/page-guard";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { audit_logs, users, tenants } from "@/db/schema";
import { getI18n } from "@/lib/i18n-server";
import { Card, Empty, PageHeader, Table, thCls, tdCls, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireRootPage();
  const { t, locale } = await getI18n();
  const rows = await db.select({ id: audit_logs.id, action: audit_logs.action, entity: audit_logs.entity, entity_id: audit_logs.entity_id, ip: audit_logs.ip, created_at: audit_logs.created_at, actor: users.email, tenant: tenants.name })
    .from(audit_logs).leftJoin(users, eq(audit_logs.actor_id, users.id)).leftJoin(tenants, eq(audit_logs.tenant_id, tenants.id))
    .orderBy(desc(audit_logs.created_at)).limit(200);
  return (
    <div className="space-y-6">
      <PageHeader title={t("root_tabAudit")} />
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty text={t("root_noAudit")} /></div> : (
          <Table head={<><th className={thCls}>{t("date")}</th><th className={thCls}>{t("root_auditAction")}</th><th className={thCls}>{t("root_auditActor")}</th><th className={thCls}>{t("root_tenants")}</th><th className={thCls}>{t("root_auditEntity")}</th><th className={thCls}>{t("root_auditIp")}</th></>}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cx(tdCls, "tabular whitespace-nowrap text-slate-500")}>{new Date(r.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "medium" })}</td>
                <td className={tdCls}><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">{r.action}</code></td>
                <td className={tdCls}>{r.actor ?? "—"}</td>
                <td className={tdCls}>{r.tenant ?? "—"}</td>
                <td className={cx(tdCls, "text-xs text-slate-500")}>{r.entity}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}</td>
                <td className={cx(tdCls, "tabular text-xs text-slate-500")}>{r.ip ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

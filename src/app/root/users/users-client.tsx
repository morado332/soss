"use client";
import { useCallback, useState } from "react";
import { Search, Users, Pencil, LockOpen } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { PersonEditor } from "@/components/person-editor";
import { Alert, Badge, Card, Empty, PageHeader, Table, btnSecondary, btnSm, cx, inputCls, tdCls, thCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Person = { id: string; name: string; email: string; role: string; is_active: boolean; last_login_at: string | null; accountant_id: string | null; locked: boolean; tenant: string | null };

export default function UsersClient() {
  const { t, err, locale } = useI18n();
  const [rows, setRows] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Person | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => { const r = await api<Person[]>(`/api/root/users?q=${encodeURIComponent(q)}`); if (r.ok) setRows(r.data as unknown as Person[]); }, [q]);
  useLoader(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);
  async function patch(id: string, body: Record<string, unknown>) {
    const r = await api("/api/root/users", "PATCH", { id, ...body });
    setMsg(r.ok ? { tone: "success", text: t("p2_saved") } : { tone: "error", text: err(r.data.error) }); load(); return r.ok;
  }
  return (
    <div className="space-y-6">
      <PageHeader title={t("p2_users")} description={t("p2_usersSub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {edit && <PersonEditor key={edit.id} title={`${t("edit")} · ${edit.name}`} initial={edit} onClose={() => setEdit(null)} onSave={(ch) => patch(edit.id, ch)} />}
      <Card padded={false} title={`${rows.length} ${t("p2_people")}`} action={<div className="relative w-56"><Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={cx(inputCls, "ps-8")} /></div>}>
        {rows.length === 0 ? <div className="p-5"><Empty icon={Users} text={t("p2_noPeople")} /></div> : (
          <Table head={<><th className={thCls}>{t("name")}</th><th className={thCls}>{t("p2_role")}</th><th className={thCls}>{t("p2_business")}</th><th className={thCls}>{t("status")}</th><th className={thCls}>{t("s_lastLogin")}</th><th className={thCls}></th></>}>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={tdCls}><p className="font-medium">{p.name}</p><p className="text-xs text-slate-500">{p.email}</p></td>
                <td className={tdCls}><Badge tone="blue">{t(`role_${p.role}` as DictKey)}</Badge>{p.accountant_id && <span className="ms-1 text-xs text-slate-500">{p.accountant_id}</span>}</td>
                <td className={tdCls}>{p.tenant ?? "—"}</td>
                <td className={tdCls}><div className="flex flex-wrap gap-1"><Badge tone={p.is_active ? "green" : "slate"}>{t(p.is_active ? "p2_active" : "p2_inactive")}</Badge>{p.locked && <Badge tone="red">{t("p2_locked")}</Badge>}</div></td>
                <td className={cx(tdCls, "text-slate-500")}>{p.last_login_at ? new Date(p.last_login_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : t("never")}</td>
                <td className={cx(tdCls, "text-end")}><div className="flex justify-end gap-1">
                  {p.locked && <button onClick={() => patch(p.id, { unlock: true })} className={cx(btnSecondary, btnSm)} title={t("p2_unlock")}><LockOpen className="h-3.5 w-3.5" /></button>}
                  <button onClick={() => setEdit(p)} className={cx(btnSecondary, btnSm)} title={t("edit")}><Pencil className="h-3.5 w-3.5" />{t("edit")}</button>
                </div></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

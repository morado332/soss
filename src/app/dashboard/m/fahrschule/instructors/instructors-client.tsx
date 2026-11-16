"use client";
import { useCallback, useState } from "react";
import { UserCheck, UserPlus } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnPrimary, btnSecondary, btnSm, cx, inputCls, tdCls, thCls } from "@/components/ui";

type Ins = { id: string; name: string; email: string | null; phone: string | null; license_classes: string; is_active: boolean; week_units: number };
const empty = { name: "", email: "", phone: "", license_classes: "B" };

export default function InstructorsClient({ canManage }: { canManage: boolean }) {
  const { t, err } = useI18n();
  const [rows, setRows] = useState<Ins[]>([]);
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const r = await api<Ins[]>("/api/m/fahrschule/instructors"); if (r.ok) setRows(r.data as unknown as Ins[]); }, []);
  useLoader(() => { load(); }, [load]);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await api("/api/m/fahrschule/instructors", "POST", { ...f, phone: f.phone || undefined });
    if (!r.ok) return setMsg(err(r.data.error));
    setF(empty); load();
  }
  async function toggle(i: Ins) { await api("/api/m/fahrschule/instructors", "PATCH", { id: i.id, is_active: !i.is_active }); load(); }
  return (
    <div className="space-y-6">
      <PageHeader title={t("fs_nav_instructors")} description={t("fs_instructors_sub")} />
      {msg && <Alert tone="error">{msg}</Alert>}
      {canManage && (
        <Card title={t("fs_new_instructor")}>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label={`${t("name")} *`} className="lg:col-span-2"><input required minLength={2} maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
            <Field label={t("email")}><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></Field>
            <Field label={t("a_phone")}><input type="tel" maxLength={40} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={inputCls} /></Field>
            <Field label={t("fs_classes")}><input maxLength={60} value={f.license_classes} onChange={(e) => setF({ ...f, license_classes: e.target.value })} className={inputCls} /></Field>
            <div className="lg:col-span-5"><button className={btnPrimary}><UserPlus className="h-4 w-4" />{t("create")}</button></div>
          </form>
        </Card>
      )}
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty icon={UserCheck} text={t("fs_none_instructors")} /></div> : (
          <Table head={<><th className={thCls}>{t("name")}</th><th className={thCls}>{t("fs_classes")}</th><th className={thCls}>{t("fs_week")}</th><th className={thCls}>{t("status")}</th><th className={thCls}></th></>}>
            {rows.map((i) => (
              <tr key={i.id} className={i.is_active ? "" : "opacity-50"}>
                <td className={tdCls}><p className="font-medium">{i.name}</p><p className="text-xs text-slate-500">{[i.email, i.phone].filter(Boolean).join(" · ") || "—"}</p></td>
                <td className={tdCls}>{i.license_classes}</td>
                <td className={cx(tdCls, "tabular")}>{t("fs_lessons_count", { n: i.week_units })}</td>
                <td className={tdCls}><Badge tone={i.is_active ? "green" : "slate"}>{i.is_active ? t("st_active") : t("p_inactive")}</Badge></td>
                <td className={cx(tdCls, "text-end")}>{canManage && <button onClick={() => toggle(i)} className={cx(btnSecondary, btnSm)}>{i.is_active ? t("p_deactivate") : t("p_activate")}</button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

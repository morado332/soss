"use client";
import { useCallback, useState } from "react";
import { UserPlus, UsersRound, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { PLATFORM_PERMISSIONS, type PlatformPermission } from "@/lib/permissions";
import { PersonEditor } from "@/components/person-editor";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnDanger, btnPrimary, btnSecondary, btnSm, cx, inputCls, tdCls, thCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Member = { id: string; name: string; email: string; permissions: string[]; is_active: boolean; last_login_at: string | null };

function PermPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t("p2_permissions")}</p>
      <div className="flex flex-wrap gap-2">
        {PLATFORM_PERMISSIONS.map((p) => (
          <label key={p} className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm", value.includes(p) ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700")}>
            <input type="checkbox" checked={value.includes(p)} onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))} />
            {t(`pp_${p.split(":")[1]}` as DictKey)}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function TeamClient() {
  const { t, err, locale } = useI18n();
  const [rows, setRows] = useState<Member[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "", permissions: ["platform:tenants"] as string[] });
  const [edit, setEdit] = useState<Member | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => { const r = await api<Member[]>("/api/root/team"); if (r.ok) setRows(r.data as unknown as Member[]); }, []);
  useLoader(() => { load(); }, [load]);
  const say = (ok: boolean, e?: unknown) => setMsg(ok ? { tone: "success", text: t("p2_saved") } : { tone: "error", text: err(e) });

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = await api("/api/root/team", "POST", f);
    say(r.ok, r.ok ? undefined : r.data.error);
    if (r.ok) { setF({ name: "", email: "", password: "", permissions: ["platform:tenants"] }); load(); }
  }
  async function remove(m: Member) {
    if (!confirm(t("p2_confirmDelete", { name: m.name }))) return;
    const r = await api(`/api/root/team?id=${m.id}`, "DELETE"); say(r.ok, r.ok ? undefined : r.data.error); load();
  }
  return (
    <div className="space-y-6">
      <PageHeader title={t("p2_team")} description={t("p2_teamSub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {edit ? (
        <PersonEditor key={edit.id} title={`${t("edit")} · ${edit.name}`} initial={edit} onClose={() => setEdit(null)} extra={() => ({ permissions: editPerms })}
          onSave={async (ch) => { const r = await api("/api/root/team", "PATCH", { id: edit.id, ...ch }); say(r.ok, r.ok ? undefined : r.data.error); load(); return r.ok; }}>
          <PermPicker value={editPerms} onChange={setEditPerms} />
        </PersonEditor>
      ) : (
        <Card title={t("p2_newAdmin")}>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("name")}><input required minLength={2} maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
            <Field label={t("email")}><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></Field>
            <Field label={t("password")} hint={t("passwordRules")}><input required type="password" autoComplete="new-password" minLength={10} maxLength={72} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} /></Field>
            <div className="sm:col-span-2 lg:col-span-3"><PermPicker value={f.permissions} onChange={(p) => setF({ ...f, permissions: p })} /></div>
            <div><button className={btnPrimary}><UserPlus className="h-4 w-4" />{t("create")}</button></div>
          </form>
        </Card>
      )}
      <Card padded={false} title={`${rows.length} ${t("p2_admins")}`}>
        {rows.length === 0 ? <div className="p-5"><Empty icon={UsersRound} text={t("p2_noAdmins")} /></div> : (
          <Table head={<><th className={thCls}>{t("name")}</th><th className={thCls}>{t("p2_permissions")}</th><th className={thCls}>{t("status")}</th><th className={thCls}>{t("s_lastLogin")}</th><th className={thCls}></th></>}>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className={tdCls}><p className="font-medium">{m.name}</p><p className="text-xs text-slate-500">{m.email}</p></td>
                <td className={tdCls}><div className="flex flex-wrap gap-1">{(m.permissions ?? []).map((p) => <Badge key={p} tone="violet">{t(`pp_${p.split(":")[1]}` as DictKey)}</Badge>)}</div></td>
                <td className={tdCls}><Badge tone={m.is_active ? "green" : "slate"}>{t(m.is_active ? "p2_active" : "p2_inactive")}</Badge></td>
                <td className={cx(tdCls, "text-slate-500")}>{m.last_login_at ? new Date(m.last_login_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : t("never")}</td>
                <td className={cx(tdCls, "text-end")}><div className="flex justify-end gap-1">
                  <button onClick={() => { setEdit(m); setEditPerms((m.permissions ?? []).filter((p) => PLATFORM_PERMISSIONS.includes(p as PlatformPermission))); }} className={cx(btnSecondary, btnSm)} title={t("edit")}><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(m)} className={cx(btnDanger, btnSm)} title={t("delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

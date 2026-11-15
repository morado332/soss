"use client";
import { useCallback, useState } from "react";
import { UserPlus, Calculator } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnPrimary, cx, inputCls, tdCls, thCls } from "@/components/ui";

type Acc = { id: string; name: string; email: string; accountant_id: string | null; is_active: boolean; last_login_at: string | null; clients: number };

export default function AccountantsClient() {
  const { t, err, locale } = useI18n();
  const [rows, setRows] = useState<Acc[]>([]);
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => { const r = await api<Acc[]>("/api/root/accountants"); if (r.ok) setRows(r.data as unknown as Acc[]); }, []);
  useLoader(() => { load(); }, [load]);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = await api<{ accountant_id: string }>("/api/root/accountants", "POST", f);
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("root_accCreated", { id: r.data.accountant_id }) }); setF({ name: "", email: "", password: "" }); load();
  }
  return (
    <div className="space-y-6">
      <PageHeader title={t("root_tabAccountants")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card title={t("root_newAccountant")}>
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("name")}><input required minLength={2} maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
          <Field label={t("email")}><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></Field>
          <Field label={t("password")} hint={t("passwordRules")}><input required type="password" autoComplete="new-password" minLength={10} maxLength={72} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} /></Field>
          <div className="flex items-start pt-7"><button className={cx(btnPrimary, "w-full")}><UserPlus className="h-4 w-4" />{t("create")}</button></div>
        </form>
      </Card>
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty icon={Calculator} text={t("root_noAccountants")} /></div> : (
          <Table head={<><th className={thCls}>{t("name")}</th><th className={thCls}>ID</th><th className={thCls}>{t("nav_clients")}</th><th className={thCls}>{t("s_lastLogin")}</th></>}>
            {rows.map((a) => (
              <tr key={a.id}>
                <td className={tdCls}><p className="font-medium">{a.name}</p><p className="text-xs text-slate-500">{a.email}</p></td>
                <td className={tdCls}><Badge tone="violet">{a.accountant_id}</Badge></td>
                <td className={cx(tdCls, "tabular")}>{t("root_clients", { n: a.clients })}</td>
                <td className={cx(tdCls, "text-slate-500")}>{a.last_login_at ? new Date(a.last_login_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : t("never")}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

"use client";
import { useCallback, useState } from "react";
import { Download, FileText, Link2, Unlink, Calculator } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { Alert, Card, Empty, Field, PageHeader, btnPrimary, btnSecondary, btnDanger, btnSm, cx, inputCls } from "@/components/ui";

type Link = { id: string; name: string; accountant_id: string | null; created_at: string };

export default function AccountantClient() {
  const { t, err, locale } = useI18n();
  const [links, setLinks] = useState<Link[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => { const r = await api<Link[]>("/api/accountant-links"); if (r.ok) setLinks(r.data as unknown as Link[]); }, []);
  useLoader(() => { load(); }, [load]);

  async function link(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = await api("/api/accountant-links", "POST", { accountant_id: code });
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setCode(""); setMsg({ tone: "success", text: t("saved") }); load();
  }
  async function unlink(id: string) { await api(`/api/accountant-links?id=${id}`, "DELETE"); load(); }

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title={t("acc_title")} description={t("acc_sub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("acc_linked")}>
          {links.length === 0 ? <Empty icon={Calculator} text={t("acc_none")} /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-3">
                  <div><p className="text-sm font-medium">{l.name}</p><p className="text-xs text-slate-500">{l.accountant_id} · {new Date(l.created_at).toLocaleDateString(locale)}</p></div>
                  <button onClick={() => unlink(l.id)} className={cx(btnDanger, btnSm)}><Unlink className="h-3.5 w-3.5" />{t("acc_unlink")}</button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={link} className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Field label={t("acc_id")} className="flex-1"><input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} pattern="ACC-[0-9]{3,10}" placeholder="ACC-1001" className={inputCls} /></Field>
            <button className={btnPrimary}><Link2 className="h-4 w-4" />{t("acc_link")}</button>
          </form>
        </Card>
        <Card title={t("acc_monthly")} description={`${from} – ${to}`}>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/exports?format=datev&from=${from}&to=${to}`} className={btnPrimary}><Download className="h-4 w-4" />{t("i_exportDatev")}</a>
            <a href={`/api/exports?format=xml&from=${from}&to=${to}`} className={btnSecondary}><FileText className="h-4 w-4" />{t("i_exportX")}</a>
          </div>
        </Card>
      </div>
    </div>
  );
}

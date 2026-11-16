"use client";
import { useCallback, useState } from "react";
import { CreditCard, PlugZap, Save, Trash2, Plus, X, Smartphone } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnDanger, btnPrimary, btnSecondary, btnSm, cx, inputCls, tdCls, thCls } from "@/components/ui";

type Cfg = { platform: { stripePublishable: string; stripeSecret: string; stripeWebhookSecret: string; sumupApiKey: string; webhookUrl: string }; tenants: { id: string; name: string; profession: string; stripe_account_id: string | null; readers: number }[] };
type Reader = { id: string; provider: string; label: string; reader_id: string; is_active: boolean };

export default function PaymentsClient() {
  const { t, err } = useI18n();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [keys, setKeys] = useState({ stripePublishable: "", stripeSecret: "", stripeWebhookSecret: "", sumupApiKey: "" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [acct, setAcct] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [nr, setNr] = useState({ provider: "stripe", label: "", reader_id: "" });
  const load = useCallback(async () => {
    const r = await api<Cfg>("/api/root/payments");
    if (r.ok) { const c = r.data as unknown as Cfg; setCfg(c); setKeys((k) => ({ ...k, stripePublishable: c.platform.stripePublishable ?? "" })); setAcct(Object.fromEntries(c.tenants.map((x) => [x.id, x.stripe_account_id ?? ""]))); }
  }, []);
  useLoader(() => { load(); }, [load]);
  const say = (ok: boolean, e?: unknown, text?: string) => setMsg(ok ? { tone: "success", text: text ?? t("p2_saved") } : { tone: "error", text: err(e) });

  async function saveKeys(e: React.FormEvent) {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(keys).filter(([k, v]) => k === "stripePublishable" || v));
    const r = await api("/api/root/payments", "PATCH", body); say(r.ok, r.ok ? undefined : r.data.error);
    if (r.ok) { setKeys((k) => ({ ...k, stripeSecret: "", stripeWebhookSecret: "", sumupApiKey: "" })); load(); }
  }
  async function clear(key: string) { const r = await api("/api/root/payments", "PATCH", { clear: [key] }); say(r.ok, r.ok ? undefined : r.data.error); load(); }
  async function test() {
    const r = await api<{ account: string }>("/api/root/payments/test", "POST", {});
    say(r.ok, r.ok ? undefined : r.data.error, r.ok ? t("p2_stripeOk", { id: r.data.account }) : undefined);
  }
  async function saveAcct(id: string) { const r = await api("/api/root/payments", "PUT", { tenant_id: id, stripe_account_id: acct[id] ?? "" }); say(r.ok, r.ok ? undefined : r.data.error); load(); }
  async function openReaders(id: string) {
    setOpen(id); setReaders([]);
    const r = await api<Reader[]>(`/api/root/payments/terminals?tenant_id=${id}`); if (r.ok) setReaders(r.data as unknown as Reader[]);
  }
  async function addReader(e: React.FormEvent) {
    e.preventDefault(); if (!open) return;
    const r = await api("/api/root/payments/terminals", "POST", { tenant_id: open, ...nr }); say(r.ok, r.ok ? undefined : r.data.error);
    if (r.ok) { setNr({ provider: "stripe", label: "", reader_id: "" }); openReaders(open); load(); }
  }
  async function delReader(id: string) { const r = await api(`/api/root/payments/terminals?id=${id}`, "DELETE"); say(r.ok, r.ok ? undefined : r.data.error); if (open) openReaders(open); load(); }

  const secretField = (key: "stripeSecret" | "stripeWebhookSecret" | "sumupApiKey", label: string, ph: string) => (
    <Field label={label} hint={cfg?.platform[key] ? `${t("p2_stored")}: ${cfg.platform[key]}` : t("p2_notSet")}>
      <div className="flex gap-2">
        <input type="password" autoComplete="off" placeholder={ph} value={keys[key]} onChange={(e) => setKeys({ ...keys, [key]: e.target.value.trim() })} className={inputCls} />
        {cfg?.platform[key] && <button type="button" onClick={() => clear(key)} className={cx(btnSecondary, btnSm)} title={t("delete")}><Trash2 className="h-3.5 w-3.5" /></button>}
      </div>
    </Field>
  );
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <div className="space-y-6">
      <PageHeader title={t("p2_payments")} description={t("p2_paymentsSub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card title={t("p2_platformKeys")} action={<button onClick={test} className={cx(btnSecondary, btnSm)}><PlugZap className="h-3.5 w-3.5" />{t("p2_testConn")}</button>}>
        <form onSubmit={saveKeys} className="grid gap-4 md:grid-cols-2">
          <Field label="Stripe Publishable key"><input value={keys.stripePublishable} placeholder="pk_live_…" onChange={(e) => setKeys({ ...keys, stripePublishable: e.target.value.trim() })} className={inputCls} /></Field>
          {secretField("stripeSecret", "Stripe Secret key", "sk_live_… / rk_live_…")}
          {secretField("stripeWebhookSecret", "Stripe Webhook secret", "whsec_…")}
          {secretField("sumupApiKey", "SumUp API key", "sup_sk_…")}
          <div className="md:col-span-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {t("p2_webhookHint")} <code className="break-all font-mono">{origin}{cfg?.platform.webhookUrl}</code> — <span>checkout.session.completed</span>
          </div>
          <div className="md:col-span-2 flex items-center gap-3"><button className={btnPrimary}><Save className="h-4 w-4" />{t("save")}</button><span className="text-xs text-slate-500">{t("p2_encrypted")}</span></div>
        </form>
      </Card>

      {open && (
        <Card title={`${t("p2_terminals")} · ${cfg?.tenants.find((x) => x.id === open)?.name ?? ""}`} action={<button onClick={() => setOpen(null)} className={cx(btnSecondary, btnSm)}><X className="h-3.5 w-3.5" /></button>}>
          <form onSubmit={addReader} className="mb-4 grid gap-3 sm:grid-cols-4">
            <Field label={t("p2_provider")}><select value={nr.provider} onChange={(e) => setNr({ ...nr, provider: e.target.value })} className={inputCls}><option value="stripe">Stripe Terminal</option><option value="sumup">SumUp</option></select></Field>
            <Field label={t("p2_label")}><input required minLength={2} maxLength={80} value={nr.label} onChange={(e) => setNr({ ...nr, label: e.target.value })} placeholder="Kasse 1" className={inputCls} /></Field>
            <Field label={t("p2_readerId")}><input required minLength={3} maxLength={100} pattern="[A-Za-z0-9_\-]+" value={nr.reader_id} onChange={(e) => setNr({ ...nr, reader_id: e.target.value.trim() })} placeholder={nr.provider === "stripe" ? "tmr_…" : "SN…"} className={inputCls} /></Field>
            <div className="flex items-end"><button className={cx(btnPrimary, "w-full")}><Plus className="h-4 w-4" />{t("add")}</button></div>
          </form>
          {readers.length === 0 ? <Empty icon={Smartphone} text={t("p2_noTerminals")} /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {readers.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <Badge tone={r.provider === "stripe" ? "violet" : "blue"}>{r.provider}</Badge>
                  <span className="flex-1 font-medium">{r.label} <code className="ms-2 text-xs text-slate-500">{r.reader_id}</code></span>
                  <button onClick={() => delReader(r.id)} className={cx(btnDanger, btnSm)}><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card padded={false} title={t("p2_tenantPayments")}>
        {!cfg || cfg.tenants.length === 0 ? <div className="p-5"><Empty icon={CreditCard} text={t("root_noTenants")} /></div> : (
          <Table head={<><th className={thCls}>{t("root_tenants")}</th><th className={thCls}>Stripe Connect (acct_…)</th><th className={thCls}>{t("p2_terminals")}</th><th className={thCls}></th></>}>
            {cfg.tenants.map((x) => (
              <tr key={x.id}>
                <td className={tdCls}><p className="font-medium">{x.name}</p><p className="text-xs text-slate-500">{x.profession}</p></td>
                <td className={tdCls}><div className="flex gap-2"><input value={acct[x.id] ?? ""} onChange={(e) => setAcct({ ...acct, [x.id]: e.target.value.trim() })} placeholder="acct_…" className={cx(inputCls, "min-w-44")} /><button onClick={() => saveAcct(x.id)} className={cx(btnSecondary, btnSm)} title={t("save")}><Save className="h-3.5 w-3.5" /></button></div></td>
                <td className={tdCls}><Badge tone={x.readers ? "green" : "slate"}>{x.readers}</Badge></td>
                <td className={cx(tdCls, "text-end")}><button onClick={() => openReaders(x.id)} className={cx(btnSecondary, btnSm)}><Smartphone className="h-3.5 w-3.5" />{t("p2_manage")}</button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

"use client";
import { useCallback, useState } from "react";
import { Building2, Plus, Search, ExternalLink, Settings2, X } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { PROFESSIONS, professionByKey, professionName } from "@/lib/professions";
import { MODULE_NAV, PROFESSION_MODULES } from "@/modules/registry";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnPrimary, btnSecondary, btnDanger, btnSm, cx, inputCls, statusTone, tdCls, thCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Tenant = { id: string; name: string; slug: string; profession: string; status: string; plan: string; monthly_fee_cents: number; commission_percent: number | null; commission_fixed_cents: number | null; tax_rate_bp: number | null; created_at: string; owner_email: string | null; disabled_modules: string[] };
const emptyForm = { name: "", profession: "friseur", owner_name: "", owner_email: "", owner_password: "", plan: "pro", percent: "5", fixed: "0.30", tax: 1900 };

export default function TenantsClient() {
  const { t, err, lang, locale } = useI18n();
  const [rows, setRows] = useState<Tenant[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState<{ id: string; percent: string; fixed: string; plan: string; tax: number; password: string; profession: string; modules: Record<string, boolean> } | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });

  const load = useCallback(async () => { const r = await api<Tenant[]>("/api/root/tenants"); if (r.ok) setRows(r.data as unknown as Tenant[]); }, []);
  useLoader(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = await api<{ tenant: { name: string } }>("/api/root/tenants", "POST", {
      name: form.name, profession: form.profession, owner_name: form.owner_name, owner_email: form.owner_email, owner_password: form.owner_password, plan: form.plan,
      commission_percent_bp: Math.round(Number(form.percent) * 100), commission_fixed_cents: Math.round(Number(form.fixed) * 100), tax_rate_bp: form.tax,
    });
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("root_created", { name: r.data.tenant.name }) }); setForm(emptyForm); setShowForm(false); load();
  }
  async function patch(body: Record<string, unknown>) {
    const r = await api("/api/root/tenants", "PATCH", body);
    setMsg(r.ok ? { tone: "success", text: t("root_termsSaved") } : { tone: "error", text: err(r.data.error) });
    load(); return r.ok;
  }
  async function saveTerms(e: React.FormEvent) {
    e.preventDefault(); if (!edit) return;
    const ok = await patch({ tenant_id: edit.id, plan: edit.plan, tax_rate_bp: edit.tax, commission_percent_bp: Math.round(Number(edit.percent) * 100), commission_fixed_cents: Math.round(Number(edit.fixed) * 100), modules: edit.modules, ...(edit.password ? { owner_password: edit.password } : {}) });
    if (ok) setEdit(null);
  }

  const shown = rows.filter((r) => !q || `${r.name} ${r.owner_email ?? ""} ${r.slug}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader title={t("root_tabTenants")} description={t("root_newTenantSub")} actions={<button onClick={() => setShowForm((s) => !s)} className={btnPrimary}>{showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showForm ? t("cancel") : t("root_newTenant")}</button>} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {showForm && (
        <Card title={t("root_newTenant")}>
          <form onSubmit={create} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={`${t("s_businessName")} *`} className="lg:col-span-2"><input required minLength={2} maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <Field label={t("l_navIndustries")}>
              <select value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} className={inputCls}>
                {PROFESSIONS.map((p) => <option key={p.key} value={p.key}>{p.icon} {professionName(p, lang)}</option>)}
              </select>
            </Field>
            <Field label={t("root_plan")}><select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className={inputCls}><option value="starter">Starter</option><option value="pro">Pro</option><option value="business">Business</option></select></Field>
            <Field label={`${t("root_ownerName")} *`}><input required minLength={2} maxLength={120} value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} className={inputCls} /></Field>
            <Field label={`${t("root_ownerEmail")} *`}><input required type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} className={inputCls} /></Field>
            <Field label={`${t("root_ownerPw")} *`} hint={t("passwordRules")} className="lg:col-span-2"><input required type="password" autoComplete="new-password" minLength={10} maxLength={72} value={form.owner_password} onChange={(e) => setForm({ ...form, owner_password: e.target.value })} className={inputCls} /></Field>
            <Field label={t("root_percent")}><input type="number" min={0} max={30} step="0.01" value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} className={inputCls} /></Field>
            <Field label={t("root_fixed")}><input type="number" min={0} max={10} step="0.01" value={form.fixed} onChange={(e) => setForm({ ...form, fixed: e.target.value })} className={inputCls} /></Field>
            <Field label={t("s_taxDefault")}><select value={form.tax} onChange={(e) => setForm({ ...form, tax: Number(e.target.value) })} className={inputCls}><option value={1900}>19 %</option><option value={700}>7 %</option><option value={0}>0 %</option></select></Field>
            <div className="flex items-end"><button className={cx(btnPrimary, "w-full")}><Building2 className="h-4 w-4" />{t("create")}</button></div>
          </form>
        </Card>
      )}

      {edit && (
        <Card title={`${t("root_editTerms")} · ${rows.find((r) => r.id === edit.id)?.name ?? ""}`} action={<button onClick={() => setEdit(null)} className={cx(btnSecondary, btnSm)}><X className="h-3.5 w-3.5" /></button>}>
          <form onSubmit={saveTerms} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label={t("root_plan")}><select value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })} className={inputCls}><option value="starter">Starter</option><option value="pro">Pro</option><option value="business">Business</option></select></Field>
            <Field label={t("root_percent")}><input type="number" min={0} max={30} step="0.01" value={edit.percent} onChange={(e) => setEdit({ ...edit, percent: e.target.value })} className={inputCls} /></Field>
            <Field label={t("root_fixed")}><input type="number" min={0} max={10} step="0.01" value={edit.fixed} onChange={(e) => setEdit({ ...edit, fixed: e.target.value })} className={inputCls} /></Field>
            <Field label={t("s_taxDefault")}><select value={edit.tax} onChange={(e) => setEdit({ ...edit, tax: Number(e.target.value) })} className={inputCls}><option value={1900}>19 %</option><option value={700}>7 %</option><option value={0}>0 %</option></select></Field>
            <Field label={`${t("root_ownerPw")} (${t("optional")})`}><input type="password" autoComplete="new-password" minLength={10} maxLength={72} value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} className={inputCls} /></Field>
            <div className="lg:col-span-5">
              <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t("root_modules")}</p>
              <div className="flex flex-wrap gap-2">
                {(PROFESSION_MODULES[edit.profession] ?? []).map((m) => (
                  <label key={m} className={cx("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm", edit.modules[m] ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700")}>
                    <input type="checkbox" checked={edit.modules[m]} onChange={(e) => setEdit({ ...edit, modules: { ...edit.modules, [m]: e.target.checked } })} />
                    {m === "fahrschule" ? t("fs_module") : t(MODULE_NAV[m][0].label)}
                  </label>
                ))}
              </div>
            </div>
            <div className="lg:col-span-5"><button className={btnPrimary}>{t("save")}</button></div>
          </form>
        </Card>
      )}

      <Card padded={false} title={`${rows.length} ${t("root_tenants")}`} action={<div className="relative w-56"><Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={cx(inputCls, "ps-8")} /></div>}>
        {shown.length === 0 ? <div className="p-5"><Empty icon={Building2} text={t("root_noTenants")} /></div> : (
          <Table head={<><th className={thCls}>{t("root_tenants")}</th><th className={thCls}>{t("l_navIndustries")}</th><th className={thCls}>{t("status")}</th><th className={thCls}>{t("d_fee")}</th><th className={thCls}></th></>}>
            {shown.map((r) => {
              const p = professionByKey(r.profession);
              return (
                <tr key={r.id}>
                  <td className={tdCls}><p className="font-medium">{r.name}</p><p className="text-xs text-slate-500">{r.owner_email ?? "—"} · {r.plan} · {money(r.monthly_fee_cents)}{t("perMonth")}</p></td>
                  <td className={tdCls}>{p.icon} {professionName(p, lang)}</td>
                  <td className={tdCls}><Badge tone={statusTone(r.status)}>{t(`st_${r.status}` as DictKey)}</Badge></td>
                  <td className={cx(tdCls, "tabular")}>{((r.commission_percent ?? 500) / 100).toLocaleString(locale)} % + {money(r.commission_fixed_cents ?? 30)}</td>
                  <td className={cx(tdCls, "text-end")}>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEdit({ id: r.id, profession: r.profession, modules: Object.fromEntries((PROFESSION_MODULES[r.profession] ?? []).map((m) => [m, !(r.disabled_modules ?? []).includes(m)])), plan: r.plan, tax: r.tax_rate_bp ?? 1900, percent: String((r.commission_percent ?? 500) / 100), fixed: ((r.commission_fixed_cents ?? 30) / 100).toFixed(2), password: "" })} className={cx(btnSecondary, btnSm)} title={t("root_editTerms")}><Settings2 className="h-3.5 w-3.5" /></button>
                      <a href={`/book/${r.slug}`} target="_blank" rel="noopener noreferrer" className={cx(btnSecondary, btnSm)} title={t("bookingLink")}><ExternalLink className="h-3.5 w-3.5" /></a>
                      {r.status === "suspended"
                        ? <button onClick={() => patch({ tenant_id: r.id, status: "active" })} className={cx(btnSecondary, btnSm)}>{t("root_activate")}</button>
                        : <button onClick={() => patch({ tenant_id: r.id, status: "suspended" })} className={cx(btnDanger, btnSm)}>{t("root_suspend")}</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}

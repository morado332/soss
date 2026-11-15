"use client";
import { useCallback, useState } from "react";
import { Save, UserPlus, Building2, Users, ShieldCheck, BadgePercent } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { Alert, Badge, Card, Field, PageHeader, btnPrimary, btnSecondary, btnSm, cx, inputCls } from "@/components/ui";
import { PasswordForm } from "@/components/password-form";
import type { DictKey } from "@/lib/i18n";

type Settings = { name: string; slug: string; plan: string; monthly_fee_cents: number; commission_percent: number | null; commission_fixed_cents: number | null; tax_rate_bp: number | null; ust_idnr: string | null; steuernummer: string | null; iban: string | null; terminal_id: string | null; tse_serial: string | null; stripe_connected: boolean };
type Staff = { id: string; name: string; email: string; role: string; permissions: string[]; is_active: boolean; last_login_at: string | null };

const presetOf = (perms: string[]) => (perms.includes("products:write") ? "manager" : perms.includes("pos:use") ? "cashier" : "reception");

export default function SettingsClient({ isOwner, slug }: { isOwner: boolean; slug: string }) {
  const { t, err, locale } = useI18n();
  const [s, setS] = useState<Settings | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [nf, setNf] = useState({ name: "", email: "", password: "", preset: "cashier" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });

  const load = useCallback(async () => {
    const r = await api<Settings>("/api/settings"); if (r.ok) setS(r.data);
    if (isOwner) { const st = await api<Staff[]>("/api/staff"); if (st.ok) setStaff(st.data as unknown as Staff[]); }
  }, [isOwner]);
  useLoader(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const r = await api("/api/settings", "PATCH", { name: s.name, ust_idnr: s.ust_idnr ?? "", steuernummer: s.steuernummer ?? "", iban: s.iban ?? "", terminal_id: s.terminal_id ?? "", tax_rate_bp: s.tax_rate_bp ?? 1900 });
    setMsg(r.ok ? { tone: "success", text: t("saved") } : { tone: "error", text: err(r.data.error) });
  }
  async function addStaff(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("/api/staff", "POST", nf);
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("s_staffCreated") }); setNf({ name: "", email: "", password: "", preset: "cashier" }); load();
  }
  async function patchStaff(id: string, body: Record<string, unknown>) { const r = await api("/api/staff", "PATCH", { id, ...body }); if (!r.ok) setMsg({ tone: "error", text: err(r.data.error) }); load(); }

  if (!s) return <p className="text-sm text-slate-500">{t("loading")}</p>;
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS({ ...s, [k]: k === "tax_rate_bp" ? Number(e.target.value) : e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader title={t("s_title")} description={t("s_sub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title={<span className="flex items-center gap-2"><Building2 className="h-4 w-4" />{t("s_business")}</span>} className="xl:col-span-2" description={isOwner ? undefined : t("s_ownerOnly")}>
          <form onSubmit={save}>
            <fieldset disabled={!isOwner} className="grid gap-4 sm:grid-cols-2">
              <Field label={t("s_businessName")} className="sm:col-span-2"><input required minLength={2} maxLength={200} value={s.name} onChange={set("name")} className={inputCls} /></Field>
              <Field label={t("s_ustid")}><input maxLength={20} value={s.ust_idnr ?? ""} onChange={set("ust_idnr")} placeholder="DE123456789" className={inputCls} /></Field>
              <Field label={t("s_steuernr")}><input maxLength={30} value={s.steuernummer ?? ""} onChange={set("steuernummer")} className={inputCls} /></Field>
              {isOwner && <Field label={t("s_iban")}><input maxLength={34} value={s.iban ?? ""} onChange={set("iban")} className={inputCls} autoComplete="off" /></Field>}
              <Field label={t("s_terminal")}><input maxLength={100} value={s.terminal_id ?? ""} onChange={set("terminal_id")} className={inputCls} /></Field>
              <Field label={t("s_taxDefault")}>
                <select value={s.tax_rate_bp ?? 1900} onChange={set("tax_rate_bp")} className={inputCls}><option value={1900}>19 %</option><option value={700}>7 %</option><option value={0}>0 %</option></select>
              </Field>
              <Field label="TSE"><input disabled value={s.tse_serial ?? "—"} className={inputCls} /></Field>
            </fieldset>
            {isOwner && <button className={cx(btnPrimary, "mt-5")}><Save className="h-4 w-4" />{t("save")}</button>}
          </form>
        </Card>

        <Card title={<span className="flex items-center gap-2"><BadgePercent className="h-4 w-4" />{t("s_conditions")}</span>} description={t("s_conditionsHint")}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">{t("root_plan")}</dt><dd className="font-medium capitalize">{s.plan}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{t("r_subscription")}</dt><dd className="tabular font-medium">{money(s.monthly_fee_cents)}{t("perMonth")}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{t("d_fee")}</dt><dd className="tabular font-medium">{((s.commission_percent ?? 500) / 100).toLocaleString(locale)} % + {money(s.commission_fixed_cents ?? 30)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Stripe Connect</dt><dd>{s.stripe_connected ? <Badge tone="green">✓</Badge> : <Badge>—</Badge>}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">{t("bookingLink")}</dt><dd><a className="font-medium text-indigo-600 hover:underline dark:text-indigo-400" href={`/book/${slug}`} target="_blank" rel="noopener noreferrer">/book/{slug}</a></dd></div>
          </dl>
        </Card>
      </div>

      {isOwner && (
        <Card title={<span className="flex items-center gap-2"><Users className="h-4 w-4" />{t("s_team")}</span>} description={t("s_teamHint")} padded={false}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {staff.map((u) => (
              <li key={u.id} className={cx("flex flex-wrap items-center gap-3 px-5 py-3", !u.is_active && "opacity-50")}>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{u.name}</p><p className="text-xs text-slate-500">{u.email} · {t("s_lastLogin")}: {u.last_login_at ? new Date(u.last_login_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" }) : t("never")}</p></div>
                {u.role === "tenant_owner" ? <Badge tone="violet">{t("role_tenant_owner")}</Badge> : (
                  <>
                    <select value={presetOf(u.permissions)} onChange={(e) => patchStaff(u.id, { preset: e.target.value })} className={cx(inputCls, "w-auto py-1.5")}>
                      {["cashier", "reception", "manager"].map((p) => <option key={p} value={p}>{t(`preset_${p}` as DictKey)}</option>)}
                    </select>
                    <button onClick={() => patchStaff(u.id, { is_active: !u.is_active })} className={cx(btnSecondary, btnSm)}>{u.is_active ? t("s_disable") : t("s_enable")}</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <form onSubmit={addStaff} className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800">
            <input required minLength={2} maxLength={120} placeholder={t("name")} value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} className={inputCls} />
            <input required type="email" placeholder={t("email")} value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} className={inputCls} />
            <input required type="password" minLength={10} maxLength={72} autoComplete="new-password" placeholder={t("password")} title={t("passwordRules")} value={nf.password} onChange={(e) => setNf({ ...nf, password: e.target.value })} className={inputCls} />
            <select value={nf.preset} onChange={(e) => setNf({ ...nf, preset: e.target.value })} className={inputCls}>
              {["cashier", "reception", "manager"].map((p) => <option key={p} value={p}>{t(`preset_${p}` as DictKey)}</option>)}
            </select>
            <button className={btnPrimary}><UserPlus className="h-4 w-4" />{t("s_addStaff")}</button>
          </form>
        </Card>
      )}

      <div className="max-w-lg"><Card title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t("s_security")}</span>}><PasswordForm /></Card></div>
    </div>
  );
}

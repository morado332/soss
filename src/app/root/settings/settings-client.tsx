"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Plus, Trash2, Palette, LayoutTemplate, Contact } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api } from "@/lib/client";
import { ImagePicker } from "@/components/image-picker";
import { Alert, Card, Field, PageHeader, btnPrimary, btnSecondary, btnSm, cx, inputCls } from "@/components/ui";
import type { Branding } from "@/core/platform";
import type { DictKey } from "@/lib/i18n";


export default function SettingsClient({ initial }: { initial: Branding }) {
  const { t, err } = useI18n();
  const router = useRouter();
  const [b, setB] = useState<Branding>(initial);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const set = <K extends keyof Branding>(k: K, v: Branding[K]) => setB({ ...b, [k]: v });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...b, logo: b.logo === initial.logo ? undefined : b.logo };
    const r = await api("/api/root/settings", "PATCH", body);
    setMsg(r.ok ? { tone: "success", text: t("p2_saved") } : { tone: "error", text: err(r.data.error) });
    if (r.ok) router.refresh();
  }
  const toggle = (k: "showIndustries" | "showModules" | "showCompliance" | "showPricing", label: DictKey) => (
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><input type="checkbox" checked={b[k]} onChange={(e) => set(k, e.target.checked)} />{t(label)}</label>
  );
  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader title={t("p2_branding")} description={t("p2_brandingSub")} actions={<button className={btnPrimary}><Save className="h-4 w-4" />{t("save")}</button>} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card title={<span className="flex items-center gap-2"><Palette className="h-4 w-4" />{t("p2_identity")}</span>}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("p2_siteName")}><input required minLength={2} maxLength={40} value={b.siteName} onChange={(e) => set("siteName", e.target.value)} className={inputCls} /></Field>
          <Field label={t("p2_logo")} hint={t("p2_logoHint")}><ImagePicker value={b.logo} onChange={(v) => set("logo", v)} size={256} /></Field>
          <Field label={t("p2_tagline")} className="md:col-span-2"><textarea maxLength={300} rows={2} value={b.tagline} onChange={(e) => set("tagline", e.target.value)} className={inputCls} /></Field>
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2"><Contact className="h-4 w-4" />{t("p2_contact")}</span>}>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t("email")}><input type="email" maxLength={254} value={b.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputCls} /></Field>
          <Field label={t("p2_phone")}><input maxLength={40} pattern="[0-9+()\/\-\s]*" value={b.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} className={inputCls} /></Field>
          <Field label={t("p2_address")}><input maxLength={200} value={b.address} onChange={(e) => set("address", e.target.value)} className={inputCls} /></Field>
          <Field label={t("p2_footer")} className="md:col-span-3"><input maxLength={300} value={b.footer} onChange={(e) => set("footer", e.target.value)} className={inputCls} /></Field>
        </div>
      </Card>
      <Card title={<span className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4" />{t("p2_landing")}</span>}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {toggle("showIndustries", "l_navIndustries")}{toggle("showModules", "p2_secModules")}{toggle("showCompliance", "p2_secCompliance")}{toggle("showPricing", "p2_secPricing")}
        </div>
        <p className="mb-2 mt-5 text-sm font-medium">{t("p2_plans")}</p>
        <div className="space-y-2">
          {b.plans.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input required maxLength={30} value={p.name} onChange={(e) => set("plans", b.plans.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} className={inputCls} />
              <input type="number" min={0} max={10000} step="1" value={p.price} onChange={(e) => set("plans", b.plans.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} className={cx(inputCls, "w-32")} />
              <button type="button" disabled={b.plans.length <= 1} onClick={() => set("plans", b.plans.filter((_, j) => j !== i))} className={cx(btnSecondary, btnSm)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {b.plans.length < 6 && <button type="button" onClick={() => set("plans", [...b.plans, { name: "Plan", price: 99 }])} className={cx(btnSecondary, btnSm)}><Plus className="h-3.5 w-3.5" />{t("add")}</button>}
        </div>
      </Card>
    </form>
  );
}

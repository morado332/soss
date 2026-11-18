"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, HeartPulse, FileHeart, FlaskConical, Stethoscope, CalendarDays, Receipt } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Card, Empty, PageHeader, cx, inputCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Res = { records: { id: string; kind: string; data: Record<string, unknown> }[]; appointments: { id: string; name: string; at: string; status: string }[]; invoices: { id: string; number: string; name: string | null; total: number; at: string }[] };
const ICON = { patients: HeartPulse, prescriptions: FileHeart, lab_tests: FlaskConical, clinic_services: Stethoscope } as Record<string, typeof HeartPulse>;

export default function SearchClient() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  useLoader(() => {
    if (q.trim().length < 2) { setRes(null); return; }
    const h = setTimeout(async () => { const r = await api<Res>(`/api/m/search?q=${encodeURIComponent(q)}`); if (r.ok) setRes(r.data); }, 250);
    return () => clearTimeout(h);
  }, [q]);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const total = res ? res.records.length + res.appointments.length + res.invoices.length : 0;
  const title = (r: Res["records"][number]) => String(r.data.name ?? r.data.test ?? r.data.diagnosis ?? (r.data.no ? `#${r.data.no}` : ""));
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_search")} description={t("se_sub")} />
      <div className="relative"><Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("se_placeholder")} className={cx(inputCls, "h-14 ps-12 text-base")} /></div>
      {res && (total === 0 ? <Card><Empty icon={Search} text={t("ph_noneFound")} /></Card> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {res.records.length > 0 && <Card title={t("se_records")} padded={false}><ul className="divide-y divide-slate-100 dark:divide-slate-800">{res.records.map((r) => { const I = ICON[r.kind] ?? Search; return (
            <li key={r.id}><Link href={`/dashboard/m/biz/${r.kind}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"><I className="h-4 w-4 text-slate-400" /><span className="flex-1 font-medium">{title(r)}</span><span className="text-xs text-slate-500">{t(`k_${r.kind}` as DictKey)}</span></Link></li>); })}</ul></Card>}
          {res.appointments.length > 0 && <Card title={t("nav_appointments")} padded={false}><ul className="divide-y divide-slate-100 dark:divide-slate-800">{res.appointments.map((a) => (
            <li key={a.id}><Link href="/dashboard/appointments" className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"><CalendarDays className="h-4 w-4 text-slate-400" /><span className="flex-1 font-medium">{a.name}</span><span className="text-xs text-slate-500">{new Date(a.at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })} · {t(`st_${a.status}` as DictKey)}</span></Link></li>))}</ul></Card>}
          {res.invoices.length > 0 && <Card title={t("nav_invoices")} padded={false}><ul className="divide-y divide-slate-100 dark:divide-slate-800">{res.invoices.map((i) => (
            <li key={i.id}><Link href={`/dashboard/invoices/${i.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50"><Receipt className="h-4 w-4 text-slate-400" /><span className="font-mono text-xs">{i.number}</span><span className="flex-1">{i.name ?? "—"}</span><span className="tabular text-xs">{money(i.total)}</span></Link></li>))}</ul></Card>}
        </div>
      ))}
    </div>
  );
}

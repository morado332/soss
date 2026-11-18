"use client";
import { useCallback, useState } from "react";
import { Hourglass, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, PageHeader, Table, btnSecondary, btnSm, cx, tdCls, thCls, type Tone } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Item = { id: string; number: string; party: string | null; amount: number; date: string; days: number };
const BUCKETS = [["b0", 0, 30, "green"], ["b30", 31, 60, "amber"], ["b60", 61, 90, "violet"], ["b90", 91, 1e9, "red"]] as const;
const bucketOf = (d: number) => BUCKETS.find(([, a, b]) => d >= a && d <= b) ?? BUCKETS[3];

export default function DebtsClient() {
  const { t, err, locale } = useI18n();
  const [data, setData] = useState<{ receivables: Item[]; payables: Item[]; canPay: boolean } | null>(null);
  const [tab, setTab] = useState<"receivables" | "payables">("receivables");
  const [msg, setMsg] = useState<string | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const load = useCallback(async () => { const r = await api<{ receivables: Item[]; payables: Item[]; canPay: boolean }>("/api/m/debts"); if (r.ok) setData(r.data); }, []);
  useLoader(() => { load(); }, [load]);
  async function pay(it: Item) {
    if (!confirm(t("db_confirmPaid", { n: it.number }))) return;
    const r = await api("/api/m/debts", "POST", { kind: tab === "receivables" ? "invoice" : "purchase", id: it.id });
    if (!r.ok) setMsg(err(r.data.error)); load();
  }
  const list = data?.[tab] ?? [];
  const sums = BUCKETS.map(([k, a, b]) => ({ k, v: list.filter((x) => x.days >= a && x.days <= b).reduce((s, x) => s + x.amount, 0) }));
  const total = sums.reduce((s, x) => s + x.v, 0);
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_debts")} description={t("db_sub")} />
      {msg && <Alert tone="error">{msg}</Alert>}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm dark:bg-slate-800/60">
        {(["receivables", "payables"] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={cx("flex-1 rounded-lg px-3 py-1.5 font-medium", tab === k ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500")}>{t(`db_${k}` as DictKey)} ({data?.[k].length ?? 0})</button>)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {sums.map((s, i) => (
          <Card key={s.k}><p className="text-xs font-medium text-slate-500">{t(`db_${s.k}` as DictKey)}</p><p className="tabular mt-1 text-xl font-semibold">{money(s.v)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className={cx("h-1.5 rounded-full", ["bg-emerald-500", "bg-amber-500", "bg-violet-500", "bg-rose-500"][i])} style={{ width: `${total ? Math.round((s.v / total) * 100) : 0}%` }} /></div></Card>
        ))}
        <Card><p className="text-xs font-medium text-slate-500">{t("db_total")}</p><p className="tabular mt-1 text-xl font-bold">{money(total)}</p></Card>
      </div>
      <Card padded={false}>
        {list.length === 0 ? <div className="p-5"><Empty icon={Hourglass} text={t("db_none")} /></div> : (
          <Table head={<><th className={thCls}>#</th><th className={thCls}>{t(tab === "receivables" ? "f_customer" : "f_supplier" as DictKey)}</th><th className={thCls}>{t("f_date")}</th><th className={thCls}>{t("db_age")}</th><th className={thCls}>{t("f_amount")}</th><th className={thCls}></th></>}>
            {list.map((it) => { const [k, , , tone] = bucketOf(it.days); return (
              <tr key={it.id}>
                <td className={cx(tdCls, "font-mono text-xs")}>{it.number}</td>
                <td className={cx(tdCls, "font-medium")}>{it.party ?? "—"}</td>
                <td className={tdCls}>{it.date ? new Date(it.date).toLocaleDateString(locale) : "—"}</td>
                <td className={tdCls}><Badge tone={tone as Tone}>{t("db_days", { n: it.days })} · {t(`db_${k}` as DictKey)}</Badge></td>
                <td className={cx(tdCls, "tabular font-semibold")}>{money(it.amount)}</td>
                <td className={cx(tdCls, "text-end")}>{data?.canPay && <button onClick={() => pay(it)} className={cx(btnSecondary, btnSm)}><CheckCircle2 className="h-3.5 w-3.5" />{t("db_markPaid")}</button>}</td>
              </tr>); })}
          </Table>
        )}
      </Card>
    </div>
  );
}

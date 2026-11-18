"use client";
import { useCallback, useState } from "react";
import { Plus, X, CalendarX, Trash2 } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { KINDS, type KindDef } from "@/modules/business/kinds";
import { RecordForm } from "@/components/records-client";
import { Badge, Card, Empty, PageHeader, Table, btnDanger, btnPrimary, btnSm, cx, tdCls, thCls, type Tone } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Row = { id: string; data: { product: string; batch_no: string; expiry: string; qty: number } };
const GROUPS: [string, number, Tone][] = [["ex_expired", 0, "red"], ["ex_30", 30, "amber"], ["ex_90", 90, "violet"], ["ex_ok", Infinity, "green"]];

export default function ExpiryClient({ canWrite }: { canWrite: boolean }) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const load = useCallback(async () => {
    const r = await api<{ rows: Row[]; refs: Record<string, Record<string, string>> }>("/api/m/biz/batches");
    if (r.ok) { setRows(r.data.rows); setNames(r.data.refs.product ?? {}); } setNow(nowMs());
  }, []);
  useLoader(() => { load(); }, [load]);
  const days = (d: string) => Math.ceil((new Date(`${d}T00:00:00`).getTime() - now) / 86_400_000);
  const groupOf = (d: number) => d < 0 ? 0 : d <= 30 ? 1 : d <= 90 ? 2 : 3;
  const sorted = [...rows].sort((a, b) => a.data.expiry.localeCompare(b.data.expiry));
  async function remove(r: Row) { if (confirm(t("ex_confirmRemove"))) { await api(`/api/m/biz/batches?id=${r.id}`, "DELETE"); load(); } }
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_expiry")} description={t("ex_sub")} actions={canWrite && <button onClick={() => setOpen(!open)} className={btnPrimary}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? t("cancel") : t("k_batches_new")}</button>} />
      {open && <RecordForm def={KINDS.batches as unknown as KindDef} onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); load(); }} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map(([k, , tone], i) => { const list = sorted.filter((r) => groupOf(days(r.data.expiry)) === i); return (
          <Card key={k}><p className="text-xs font-medium text-slate-500">{t(k as DictKey)}</p><p className="mt-1 text-2xl font-bold">{list.length}</p>
            <p className="text-xs text-slate-500"><Badge tone={tone}>{list.reduce((s, r) => s + r.data.qty, 0)} {t("ex_units")}</Badge></p></Card>); })}
      </div>
      <Card padded={false}>
        {sorted.length === 0 ? <div className="p-5"><Empty icon={CalendarX} text={t("ex_none")} /></div> : (
          <Table head={<><th className={thCls}>{t("f_product")}</th><th className={thCls}>{t("f_batch_no")}</th><th className={thCls}>{t("f_expiry")}</th><th className={thCls}>{t("f_qty")}</th><th className={thCls}>{t("status")}</th><th className={thCls}></th></>}>
            {sorted.map((r) => { const d = days(r.data.expiry); const [k, , tone] = GROUPS[groupOf(d)]; return (
              <tr key={r.id} className={cx(d < 0 && "bg-rose-50/50 dark:bg-rose-950/20")}>
                <td className={cx(tdCls, "font-medium")}>{names[r.data.product] ?? "—"}</td>
                <td className={cx(tdCls, "font-mono text-xs")}>{r.data.batch_no}</td>
                <td className={tdCls}>{new Date(`${r.data.expiry}T00:00:00`).toLocaleDateString(locale)}</td>
                <td className={cx(tdCls, "tabular")}>{r.data.qty}</td>
                <td className={tdCls}><Badge tone={tone}>{d < 0 ? t("ex_expiredAgo", { n: -d }) : t("ex_inDays", { n: d })} · {t(k as DictKey)}</Badge></td>
                <td className={cx(tdCls, "text-end")}>{canWrite && <button onClick={() => remove(r)} className={cx(btnDanger, btnSm)} title={t("ex_remove")}><Trash2 className="h-3.5 w-3.5" /></button>}</td>
              </tr>); })}
          </Table>
        )}
      </Card>
    </div>
  );
}

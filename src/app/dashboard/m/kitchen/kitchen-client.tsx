"use client";
import { useCallback, useState } from "react";
import { Plus, X, Minus, ChefHat, ArrowRight, Timer } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { Alert, Card, Field, PageHeader, btnPrimary, btnSecondary, btnSm, cx, inputCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Line = { name: string; qty: number; note?: string };
type Order = { id: string; customer_name: string | null; status: string; created_at: string; items: { lines: Line[]; note?: string } };
type Opt = { id: string; title: string; price_cents?: number };
const COLS = [["new", "preparing", "border-t-sky-500"], ["preparing", "ready", "border-t-amber-500"], ["ready", "served", "border-t-emerald-500"]] as const;

export default function KitchenClient() {
  const { t, err } = useI18n();
  const [d, setD] = useState<{ rows: Order[]; tables: Opt[] } | null>(null);
  const [prods, setProds] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState("");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const load = useCallback(async () => { const r = await api<{ rows: Order[]; tables: Opt[] }>("/api/m/kitchen"); if (r.ok) setD(r.data); setNow(nowMs()); }, []);
  useLoader(() => { load(); api<Opt[]>("/api/m/lookup?type=product").then((r) => r.ok && setProds(r.data as unknown as Opt[])); const h = setInterval(load, 10000); return () => clearInterval(h); }, [load]);
  async function move(o: Order, status: string) { const r = await api("/api/m/kitchen", "PATCH", { id: o.id, status }); if (!r.ok) setMsg(err(r.data.error)); load(); }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const items = Object.entries(cart).filter(([, n]) => n > 0).map(([product_id, qty]) => ({ product_id, qty }));
    if (!items.length) return;
    const r = await api("/api/m/kitchen", "POST", { table, note, items });
    if (!r.ok) return setMsg(err(r.data.error));
    setCart({}); setNote(""); setTable(""); setOpen(false); setMsg(null); load();
  }
  const mins = (s: string) => Math.max(0, Math.round((now - new Date(s).getTime()) / 60000));
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_kitchen")} description={t("ki_sub")} actions={<button onClick={() => setOpen(!open)} className={btnPrimary}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? t("cancel") : t("ki_new")}</button>} />
      {msg && <Alert tone="error">{msg}</Alert>}
      {open && <Card title={t("ki_new")}>
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("f_table")}>{d?.tables.length ? <select value={table} onChange={(e) => setTable(e.target.value)} className={inputCls}><option value="">{t("ki_takeaway")}</option>{d.tables.map((x) => <option key={x.id} value={x.title}>{x.title}</option>)}</select>
              : <input value={table} maxLength={60} onChange={(e) => setTable(e.target.value)} placeholder={t("ki_takeaway")} className={inputCls} />}</Field>
            <Field label={t("f_notes")} className="sm:col-span-2"><input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={inputCls} /></Field>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={inputCls} />
          <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {prods.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase())).map((p) => (
              <div key={p.id} className={cx("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm", cart[p.id] ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-500/10" : "border-slate-200 dark:border-slate-700")}>
                <span className="flex-1 truncate">{p.title}</span>
                <button type="button" onClick={() => setCart({ ...cart, [p.id]: Math.max(0, (cart[p.id] ?? 0) - 1) })} className={cx(btnSecondary, btnSm)}><Minus className="h-3 w-3" /></button>
                <span className="w-5 text-center tabular-nums">{cart[p.id] ?? 0}</span>
                <button type="button" onClick={() => setCart({ ...cart, [p.id]: (cart[p.id] ?? 0) + 1 })} className={cx(btnSecondary, btnSm)}><Plus className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
          <button className={btnPrimary}><ChefHat className="h-4 w-4" />{t("ki_send")}</button>
        </form>
      </Card>}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLS.map(([st, next, border]) => { const list = (d?.rows ?? []).filter((o) => o.status === st).reverse(); return (
          <div key={st} className={cx("rounded-xl border border-t-4 border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50", border)}>
            <p className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">{t(`o_${st}` as DictKey)}<span className="rounded-full bg-white px-2 text-xs dark:bg-slate-800">{list.length}</span></p>
            <div className="space-y-3">
              {list.map((o) => (
                <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">{o.customer_name || t("ki_takeaway")}</span>
                    <span className={cx("flex items-center gap-1 text-xs", mins(o.created_at) > 20 ? "font-bold text-rose-600" : "text-slate-500")}><Timer className="h-3.5 w-3.5" />{mins(o.created_at)} min</span></div>
                  <ul className="space-y-0.5 text-sm">{(o.items?.lines ?? []).map((l, i) => <li key={i}><b>{l.qty}×</b> {l.name}{l.note && <span className="text-xs text-slate-500"> · {l.note}</span>}</li>)}</ul>
                  {o.items?.note && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{o.items.note}</p>}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => move(o, next)} className={cx(btnPrimary, btnSm, "flex-1 justify-center")}>{t(`o_${next}` as DictKey)}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" /></button>
                    {st === "new" && <button onClick={() => move(o, "cancelled")} className={cx(btnSecondary, btnSm)}><X className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>); })}
      </div>
    </div>
  );
}

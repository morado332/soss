"use client";
import { useCallback, useState } from "react";
import { Plus, X, Trash2, Save, ShoppingBasket } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnDanger, btnPrimary, btnSecondary, btnSm, cx, inputCls, tdCls, thCls } from "@/components/ui";

type Opt = { id: string; title: string; cost_cents?: number };
type Line = { product_id: string; qty: string; cost: string };
type Row = { id: string; data: { no: number; supplier_name: string | null; date: string; invoice_no: string; paid: boolean; total: number; lines: { name: string; qty: number; cost_cents: number }[] } };
const today = () => new Date().toISOString().slice(0, 10);

export default function PurchasesClient() {
  const { t, err, locale } = useI18n();
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const [rows, setRows] = useState<Row[]>([]);
  const [prods, setProds] = useState<Opt[]>([]);
  const [sups, setSups] = useState<Opt[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ supplier: "", date: today(), invoice_no: "", paid: false, notes: "" });
  const [lines, setLines] = useState<Line[]>([{ product_id: "", qty: "1", cost: "" }]);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([api<Row[]>("/api/m/purchases"), api<Opt[]>("/api/m/lookup?type=product"), api<Opt[]>("/api/m/biz/suppliers?lite=1")]);
    if (a.ok) setRows(a.data as unknown as Row[]); if (b.ok) setProds(b.data as unknown as Opt[]); if (c.ok) setSups(c.data as unknown as Opt[]);
  }, []);
  useLoader(() => { load(); }, [load]);
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * Math.round((Number(l.cost.replace(",", ".")) || 0) * 100), 0);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("/api/m/purchases", "POST", { ...f, lines: lines.filter((l) => l.product_id).map((l) => ({ product_id: l.product_id, qty: Math.round(Number(l.qty)), cost_cents: Math.round(Number(l.cost.replace(",", ".")) * 100) })) });
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("pu_saved") }); setOpen(false); setLines([{ product_id: "", qty: "1", cost: "" }]); setF({ supplier: "", date: today(), invoice_no: "", paid: false, notes: "" }); load();
  }
  async function remove(r: Row) {
    if (!confirm(t("pu_confirmDelete"))) return;
    const res = await api(`/api/m/purchases?id=${r.id}`, "DELETE"); setMsg(res.ok ? null : { tone: "error", text: err(res.data.error) }); load();
  }
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_purchases")} description={t("pu_sub")} actions={<button onClick={() => setOpen(!open)} className={btnPrimary}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? t("cancel") : t("pu_new")}</button>} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {open && <Card title={t("pu_new")}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("f_supplier")}><select value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} className={inputCls}><option value="">—</option>{sups.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></Field>
            <Field label={`${t("f_date")} *`}><input required type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} /></Field>
            <Field label={t("pu_invoiceNo")}><input maxLength={60} value={f.invoice_no} onChange={(e) => setF({ ...f, invoice_no: e.target.value })} className={inputCls} /></Field>
            <Field label={t("o_paid")}><label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} />{t("pu_paidNow")}</label></Field>
          </div>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_110px_140px_auto]">
                <select required value={l.product_id} onChange={(e) => { const p = prods.find((x) => x.id === e.target.value); setLines(lines.map((x, j) => j === i ? { ...x, product_id: e.target.value, cost: x.cost || (p?.cost_cents ? (p.cost_cents / 100).toFixed(2) : "") } : x)); }} className={inputCls}>
                  <option value="">{t("pu_product")}</option>{prods.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
                <input required type="number" min={1} step={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} placeholder={t("pu_qty")} className={inputCls} />
                <input required type="number" min={0} step="0.01" value={l.cost} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, cost: e.target.value } : x))} placeholder={t("pu_cost")} className={inputCls} />
                <button type="button" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} className={cx(btnSecondary, btnSm)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setLines([...lines, { product_id: "", qty: "1", cost: "" }])} className={cx(btnSecondary, btnSm)}><Plus className="h-3.5 w-3.5" />{t("pu_addLine")}</button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-lg font-semibold">{t("pu_total")}: <span className="tabular">{money(total)}</span></p>
            <button className={btnPrimary}><Save className="h-4 w-4" />{t("pu_book")}</button>
          </div>
        </form>
      </Card>}
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty icon={ShoppingBasket} text={t("biz_empty")} /></div> : (
          <Table head={<><th className={thCls}>#</th><th className={thCls}>{t("f_supplier")}</th><th className={thCls}>{t("f_date")}</th><th className={thCls}>{t("ph_items")}</th><th className={thCls}>{t("pu_total")}</th><th className={thCls}>{t("status")}</th><th className={thCls}></th></>}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={cx(tdCls, "font-mono text-xs")}>EK-{String(r.data.no).padStart(4, "0")}<p className="text-slate-500">{r.data.invoice_no}</p></td>
                <td className={cx(tdCls, "font-medium")}>{r.data.supplier_name ?? "—"}</td>
                <td className={tdCls}>{new Date(`${r.data.date}T00:00:00`).toLocaleDateString(locale)}</td>
                <td className={cx(tdCls, "text-xs")}>{r.data.lines.map((l, i) => <div key={i}>{l.qty}× {l.name} <span className="text-slate-500">à {money(l.cost_cents)}</span></div>)}</td>
                <td className={cx(tdCls, "tabular font-semibold")}>{money(r.data.total)}</td>
                <td className={tdCls}><Badge tone={r.data.paid ? "green" : "amber"}>{t(r.data.paid ? "o_paid" : "pu_open")}</Badge></td>
                <td className={cx(tdCls, "text-end")}><button onClick={() => remove(r)} className={cx(btnDanger, btnSm)}><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

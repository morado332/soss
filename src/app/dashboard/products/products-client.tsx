"use client";
import { useCallback, useState } from "react";
import { Plus, Package, Pencil, Search, X } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnPrimary, btnSecondary, btnSm, cx, inputCls, tdCls, thCls } from "@/components/ui";

type P = { id: string; name: string; barcode: string | null; category: string | null; price_cents: number; stock: number; low_stock_threshold: number | null; is_active: boolean };
const empty = { name: "", barcode: "", category: "", price: "", stock: "0", threshold: "5" };

export default function ProductsClient() {
  const { t, err, locale } = useI18n();
  const [items, setItems] = useState<P[]>([]);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });

  const load = useCallback(async () => { const r = await api<P[]>("/api/products"); if (r.ok) setItems(r.data as unknown as P[]); }, []);
  useLoader(() => { load(); }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const body = {
      name: form.name, barcode: form.barcode || undefined, category: form.category || undefined,
      price_cents: Math.round(Number(form.price) * 100), stock: Number(form.stock), low_stock_threshold: Number(form.threshold),
    };
    const r = editId ? await api("/api/products", "PATCH", { id: editId, ...body, barcode: form.barcode }) : await api("/api/products", "POST", body);
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("p_saved") }); setForm(empty); setEditId(null); load();
  }
  function edit(p: P) {
    setEditId(p.id);
    setForm({ name: p.name, barcode: p.barcode ?? "", category: p.category ?? "", price: (p.price_cents / 100).toFixed(2), stock: String(p.stock), threshold: String(p.low_stock_threshold ?? 5) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function toggle(p: P) { await api("/api/products", "PATCH", { id: p.id, is_active: !p.is_active }); load(); }

  const shown = items.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.barcode ?? "").includes(q));

  return (
    <div className="space-y-6">
      <PageHeader title={t("p_title")} description={t("p_sub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card title={editId ? t("edit") : t("p_new")} action={editId ? <button onClick={() => { setEditId(null); setForm(empty); }} className={cx(btnSecondary, btnSm)}><X className="h-3.5 w-3.5" />{t("cancel")}</button> : undefined}>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label={`${t("p_name")} *`} className="lg:col-span-2"><input required maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
          <Field label={t("p_barcode")}><input maxLength={64} pattern="[0-9A-Za-z\-]*" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={inputCls} /></Field>
          <Field label={`${t("p_price")} *`}><input required type="number" min="0" max="1000000" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} /></Field>
          <Field label={t("p_stock")}><input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={inputCls} /></Field>
          <Field label={t("p_threshold")}><input type="number" min="0" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} className={inputCls} /></Field>
          <Field label={t("p_category")} className="lg:col-span-2"><input maxLength={100} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} /></Field>
          <div className="flex items-end lg:col-span-4"><button className={btnPrimary}><Plus className="h-4 w-4" />{editId ? t("save") : t("add")}</button></div>
        </form>
      </Card>

      <Card title={t("p_count", { n: items.length })} padded={false} action={
        <div className="relative w-56"><Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={cx(inputCls, "ps-8")} /></div>
      }>
        {shown.length === 0 ? <div className="p-5"><Empty icon={Package} text={t("p_none")} /></div> : (
          <Table head={<><th className={thCls}>{t("p_name")}</th><th className={thCls}>{t("p_barcode")}</th><th className={cx(thCls, "text-end")}>{t("p_price")}</th><th className={cx(thCls, "text-end")}>{t("p_stock")}</th><th className={thCls}>{t("status")}</th><th className={thCls}></th></>}>
            {shown.map((p) => {
              const low = p.stock <= (p.low_stock_threshold ?? 5);
              return (
                <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
                  <td className={tdCls}><p className="font-medium">{p.name}</p>{p.category && <p className="text-xs text-slate-500">{p.category}</p>}</td>
                  <td className={cx(tdCls, "tabular text-slate-500")}>{p.barcode ?? "—"}</td>
                  <td className={cx(tdCls, "tabular text-end font-medium")}>{money(p.price_cents)}</td>
                  <td className={cx(tdCls, "tabular text-end")}>{p.stock}</td>
                  <td className={tdCls}>{!p.is_active ? <Badge>{t("p_inactive")}</Badge> : low ? <Badge tone="amber">{t("p_low")}</Badge> : <Badge tone="green">{t("p_ok")}</Badge>}</td>
                  <td className={cx(tdCls, "text-end")}>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => edit(p)} className={cx(btnSecondary, btnSm)} aria-label={t("edit")}><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => toggle(p)} className={cx(btnSecondary, btnSm)}>{p.is_active ? t("p_deactivate") : t("p_activate")}</button>
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

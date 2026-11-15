"use client";
import { useCallback, useState } from "react";
import { Plus, Trash2, Download, FileText, Receipt, Eye } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnDanger, btnPrimary, btnSecondary, btnSm, cx, inputCls, statusTone, tdCls, thCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Inv = { id: string; number: string; type: string; status: string; customer_name: string | null; total_cents: number; tax_cents: number; issued_at: string; tse_reference: string | null };
type Line = { name: string; quantity: string; price: string };

export default function InvoicesClient({ canWrite, defaultTax }: { canWrite: boolean; defaultTax: number }) {
  const { t, err, locale } = useI18n();
  const [items, setItems] = useState<Inv[]>([]);
  const [customer, setCustomer] = useState({ name: "", email: "" });
  const [lines, setLines] = useState<Line[]>([{ name: "", quantity: "1", price: "" }]);
  const [tax, setTax] = useState(defaultTax);
  const [range, setRange] = useState({ from: "", to: "" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });

  const load = useCallback(async () => { const r = await api<Inv[]>("/api/invoices"); if (r.ok) setItems(r.data as unknown as Inv[]); }, []);
  useLoader(() => { load(); }, [load]);

  const total = lines.reduce((s, l) => s + Math.round(Number(l.price || 0) * 100) * Number(l.quantity || 0), 0);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await api<{ invoice: Inv }>("/api/invoices", "POST", {
      customer_name: customer.name, customer_email: customer.email || undefined, tax_rate_bp: tax,
      items: lines.map((l) => ({ name: l.name, quantity: Number(l.quantity), unit_price_cents: Math.round(Number(l.price) * 100) })),
    });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("i_created", { number: r.data.invoice.number }) });
    setCustomer({ name: "", email: "" }); setLines([{ name: "", quantity: "1", price: "" }]); load();
  }
  async function storno(id: string) {
    if (!confirm(t("i_stornoConfirm"))) return;
    const r = await api<{ storno: Inv }>("/api/invoices", "PATCH", { invoice_id: id });
    setMsg(r.ok ? { tone: "success", text: t("i_stornoCreated", { number: r.data.storno.number }) } : { tone: "error", text: err(r.data.error) });
    load();
  }
  const qs = new URLSearchParams(Object.entries(range).filter(([, v]) => v)).toString();

  return (
    <div className="space-y-6">
      <PageHeader title={t("i_title")} description={t("i_sub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {canWrite && (
        <Card title={t("i_new")}>
          <form onSubmit={create} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label={`${t("customer")} *`}><input required maxLength={200} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className={inputCls} /></Field>
              <Field label={t("email")}><input type="email" maxLength={254} value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} className={inputCls} /></Field>
              <Field label={t("i_vatRate")}>
                <select value={tax} onChange={(e) => setTax(Number(e.target.value))} className={inputCls}><option value={1900}>19 %</option><option value={700}>7 %</option><option value={0}>0 %</option></select>
              </Field>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_130px_auto] gap-2">
                  <input required maxLength={200} placeholder={t("i_item")} value={l.name} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inputCls} />
                  <input required type="number" min={1} max={10000} placeholder={t("i_qty")} title={t("i_qty")} value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} className={inputCls} />
                  <input required type="number" min={0} step="0.01" placeholder={t("i_unit")} title={t("i_unit")} value={l.price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className={inputCls} />
                  <button type="button" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))} className={cx(btnSecondary, "px-3")} aria-label={t("delete")}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" disabled={lines.length >= 100} onClick={() => setLines([...lines, { name: "", quantity: "1", price: "" }])} className={cx(btnSecondary, btnSm)}><Plus className="h-3.5 w-3.5" />{t("i_addItem")}</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-sm text-slate-500">{t("total")}: <span className="tabular text-lg font-semibold text-slate-900 dark:text-white">{money(total)}</span></p>
              <button disabled={busy} className={btnPrimary}><Receipt className="h-4 w-4" />{t("create")}</button>
            </div>
          </form>
        </Card>
      )}

      <Card padded={false} title={t("nav_invoices")} action={
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" aria-label={t("i_from")} value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className={cx(inputCls, "w-auto py-1.5")} />
          <input type="date" aria-label={t("i_to")} value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className={cx(inputCls, "w-auto py-1.5")} />
          <a href={`/api/exports?format=datev${qs ? "&" + qs : ""}`} className={cx(btnSecondary, btnSm)}><Download className="h-3.5 w-3.5" />{t("i_exportDatev")}</a>
          <a href={`/api/exports?format=xml${qs ? "&" + qs : ""}`} className={cx(btnSecondary, btnSm)}><FileText className="h-3.5 w-3.5" />XML</a>
        </div>
      }>
        {items.length === 0 ? <div className="p-5"><Empty icon={Receipt} text={t("i_none")} /></div> : (
          <Table head={<><th className={thCls}>{t("i_number")}</th><th className={thCls}>{t("customer")}</th><th className={thCls}>{t("date")}</th><th className={cx(thCls, "text-end")}>{t("i_vat")}</th><th className={cx(thCls, "text-end")}>{t("total")}</th><th className={thCls}>{t("status")}</th><th className={thCls}></th></>}>
            {items.map((i) => (
              <tr key={i.id}>
                <td className={cx(tdCls, "tabular font-medium")}>{i.number}{i.tse_reference && <span className="ms-2 text-[10px] font-semibold text-emerald-600">{t("i_signed")}</span>}</td>
                <td className={tdCls}>{i.customer_name ?? "—"}</td>
                <td className={cx(tdCls, "tabular text-slate-500")}>{new Date(i.issued_at).toLocaleDateString(locale)}</td>
                <td className={cx(tdCls, "tabular text-end text-slate-500")}>{money(i.tax_cents)}</td>
                <td className={cx(tdCls, "tabular text-end font-semibold")}>{money(i.total_cents)}</td>
                <td className={tdCls}><Badge tone={i.type === "storno" ? "red" : statusTone(i.status)}>{i.type === "storno" ? t("i_stornoOf") : t(`st_${i.status}` as DictKey)}</Badge></td>
                <td className={cx(tdCls, "text-end")}>
                  <div className="flex justify-end gap-1">
                    <Link href={`/dashboard/invoices/${i.id}`} className={cx(btnSecondary, btnSm)} aria-label={t("i_view")}><Eye className="h-3.5 w-3.5" /></Link>
                    {canWrite && i.type !== "storno" && i.status !== "storno" && <button onClick={() => storno(i.id)} className={cx(btnDanger, btnSm)}>{t("i_storno")}</button>}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

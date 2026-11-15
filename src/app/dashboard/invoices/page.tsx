"use client";
import { useEffect, useState } from "react";

type Inv = { id: string; number: string; type: string; status: string; customer_name: string | null; total_cents: number; tax_cents: number; issued_at: string; tse_reference: string | null };

export default function InvoicesPage() {
  const [items, setItems] = useState<Inv[]>([]);
  const [form, setForm] = useState({ customer_name: "", amount: "", tax_rate_bp: 1900 });
  const [msg, setMsg] = useState("");
  useEffect(() => { load(); }, []);
  async function load() { setItems(await fetch("/api/invoices-list").then((r) => r.json()).catch(() => [])); }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    const gross = Math.round(Number(form.amount) * 100);
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_name: form.customer_name, tax_rate_bp: form.tax_rate_bp, items: [{ name: "Leistung / Produkt", quantity: 1, unit_price_cents: gross }] }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? `✓ Rechnung ${d.invoice.number} erstellt (GoBD-unveränderbar, TSE: ${d.invoice.tse_reference})` : "❌ " + (d.error || "Fehler"));
    if (res.ok) load();
  }
  async function storno(id: string) {
    const res = await fetch("/api/invoices", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoice_id: id }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? `✓ Storno ${d.storno.number} erstellt.` : "❌ " + (d.error || "Fehler"));
    load();
  }
  const eur = (c: number) => (c / 100).toFixed(2) + " €";
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold">🧾 Rechnungen (GoBD)</h1><p className="text-sm text-slate-500">Rechnungen werden niemals gelöscht oder geändert — Korrektur nur per Storno. Sequenzielle Nummern pro Geschäft, TSE-Signatur, MwSt. 7%/19%.</p></div>
      <form onSubmit={create} className="flex flex-wrap gap-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Kundenname *" className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
        <input required type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="Brutto € *" className="w-36 rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
        <select value={form.tax_rate_bp} onChange={(e) => setForm({ ...form, tax_rate_bp: Number(e.target.value) })} className="rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
          <option value={1900}>MwSt. 19%</option><option value={700}>MwSt. 7%</option>
        </select>
        <button className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white">Rechnung erstellen</button>
        {msg && <p className="w-full text-sm">{msg}</p>}
      </form>
      <div className="flex flex-wrap gap-2">
        <a href="/api/exports?format=datev" className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white">⬇ DATEV exportieren</a>
        <a href="/api/exports?format=xrechnung" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">⬇ XRechnung / ZUGFeRD</a>
        <span className="self-center text-xs text-slate-400">Monatsversand an Steuerberater: automatisch am Monatsende.</span>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3 text-start">Nummer</th><th className="p-3 text-start">Kunde</th><th className="p-3 text-start">Datum</th><th className="p-3 text-start">MwSt.</th><th className="p-3 text-start">Gesamt</th><th className="p-3 text-start">TSE</th><th className="p-3 text-start">Aktion</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((i) => (
              <tr key={i.id}><td className="p-3 font-bold">{i.number}{i.type === "storno" ? " (Storno)" : ""}</td><td className="p-3">{i.customer_name ?? "—"}</td><td className="p-3">{new Date(i.issued_at).toLocaleDateString("de-DE")}</td><td className="p-3">{eur(i.tax_cents)}</td><td className="p-3 font-bold">{eur(i.total_cents)}</td><td className="p-3 text-xs">{i.tse_reference ? "✓ signiert" : "—"}</td>
                <td className="p-3">{i.type !== "storno" && i.status !== "storno" ? <button onClick={() => storno(i.id)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600">Storno</button> : <span className="text-xs text-slate-400">—</span>}</td></tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Noch keine Rechnungen.</p>}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

type P = { id: string; name: string; barcode: string | null; price_cents: number; stock: number; low_stock_threshold: number | null; category: string | null; variants: unknown };

export default function ProductsPage() {
  const [items, setItems] = useState<P[]>([]);
  const [form, setForm] = useState({ name: "", barcode: "", price: "", stock: "10", category: "General" });
  const [msg, setMsg] = useState("");
  useEffect(() => { load(); }, []);
  async function load() { setItems(await fetch("/api/products-list").then((r) => r.json()).catch(() => [])); }
  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, barcode: form.barcode || undefined, price_cents: Math.round(Number(form.price) * 100), stock: Number(form.stock), category: form.category }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "✓ Produkt gespeichert." : "❌ " + (d.error || "Fehler"));
    if (res.ok) { setForm({ name: "", barcode: "", price: "", stock: "10", category: "General" }); load(); }
  }
  const eur = (c: number) => (c / 100).toFixed(2) + " €";
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold">📦 Produkte & Lager</h1><p className="text-sm text-slate-500">Barcode scannen → Name & Preis eingeben → speichern. Bekleidung: Varianten (Größe/Farbe) werden pro Produkt geführt.</p></div>
      <form onSubmit={create} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-5 dark:border-slate-800 dark:bg-slate-900">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Produktname *" className="rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
        <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Barcode (EAN)" className="rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
        <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Preis € *" className="rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
        <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Lager" className="rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
        <button className="rounded-xl bg-blue-600 py-2.5 font-semibold text-white">+ Hinzufügen</button>
        {msg && <p className="text-sm md:col-span-5">{msg}</p>}
      </form>
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-start text-xs uppercase text-slate-500 dark:bg-slate-800"><tr><th className="p-3 text-start">Produkt</th><th className="p-3 text-start">Barcode</th><th className="p-3 text-start">Preis</th><th className="p-3 text-start">Lager</th><th className="p-3 text-start">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((p) => {
              const low = p.stock <= (p.low_stock_threshold ?? 5);
              return (
                <tr key={p.id}><td className="p-3 font-medium">{p.name}<span className="block text-xs text-slate-400">{p.category}</span></td><td className="p-3">{p.barcode ?? "—"}</td><td className="p-3 font-bold">{eur(p.price_cents)}</td><td className="p-3">{p.stock}</td>
                  <td className="p-3">{low ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">⚠️ Nachbestellen</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">OK</span>}</td></tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Noch keine Produkte.</p>}
      </div>
    </div>
  );
}

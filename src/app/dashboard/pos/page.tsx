"use client";
import { useEffect, useState } from "react";

type Product = { id: string; name: string; barcode: string | null; price_cents: number; stock: number; category: string | null };
type CartItem = { id: string; name: string; price: number; qty: number };

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [method, setMethod] = useState("terminal");
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetch("/api/me").then(() => {}); load(); }, []);
  async function load() {
    // products are loaded via server-rendered list below fallback: fetch from a lightweight endpoint using me + page data
    // We reuse the dashboard data by calling the products API through a GET shim: use window location data
    const res = await fetch("/api/products-list").catch(() => null);
    if (res?.ok) setProducts(await res.json());
  }

  const gross = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round((gross * 1900) / 11900);
  const commission = Math.round(gross * 0.05) + (cart.length ? 30 : 0);
  const net = gross - tax - commission;

  function add(p: Product) { setCart((c) => { const ex = c.find((x) => x.id === p.id); return ex ? c.map((x) => x.id === p.id ? { ...x, qty: x.qty + 1 } : x) : [...c, { id: p.id, name: p.name, price: p.price_cents, qty: 1 }]; }); }
  function scan() {
    const p = products.find((x) => x.barcode === barcode.trim());
    if (p) { add(p); setMsg(`✓ ${p.name} — ${(p.price_cents / 100).toFixed(2)}€`); } else setMsg("❌ Barcode nicht gefunden — bitte Produkt aus Liste wählen oder anlegen.");
    setBarcode("");
  }

  async function checkout() {
    setLoading(true); setMsg("");
    const res = await fetch("/api/pos/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: cart.map((c) => ({ product_id: c.id, quantity: c.qty })), method }) });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setMsg("❌ " + (data.error || "Fehler")); return; }
    setResult(data);
    setMsg(method === "terminal" ? "💳 Betrag an Terminal gesendet — Zahlung abgeschlossen." : method === "cash" ? `💵 Barzahlung · TSE: ${data.tse_reference}` : "🌐 Online-Zahlung abgeschlossen.");
    setCart([]);
    load();
  }

  const eur = (c: number) => (c / 100).toFixed(2) + " €";

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-extrabold">🛒 Kasse (POS) — Touch-optimiert</h1><p className="text-sm text-slate-500">Barcode scannen (USB-Scanner oder Kamera) → Preis erscheint automatisch → Bar / Terminal / Online. Bei Barzahlung: TSE-Signatur (Fiskaly).</p></div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} placeholder="Barcode scannen / eingeben + Enter" className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-lg dark:border-slate-700 dark:bg-slate-900" />
            <button onClick={scan} className="rounded-2xl bg-slate-900 px-5 font-semibold text-white dark:bg-white dark:text-slate-900">Scannen</button>
          </div>
          {msg && <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm dark:bg-blue-950">{msg}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((p) => (
              <button key={p.id} onClick={() => add(p)} className="rounded-3xl border border-slate-200 bg-white p-4 text-start hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <p className="font-bold leading-tight">{p.name}</p>
                <p className="mt-1 text-xs text-slate-400">{p.barcode ?? "—"} · Lager {p.stock}</p>
                <p className="mt-2 text-xl font-extrabold text-blue-600">{eur(p.price_cents)}</p>
              </button>
            ))}
          </div>
          {products.length === 0 && <p className="text-sm text-slate-500">Keine Produkte — legen Sie zuerst Produkte unter „Produkte & Lager“ an (Barcode-Button).</p>}
        </div>
        <div className="h-fit rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:top-24">
          <h2 className="font-bold">Warenkorb ({cart.reduce((s, i) => s + i.qty, 0)})</h2>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {cart.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>{c.name} × {c.qty}</span>
                <span className="flex items-center gap-2"><b>{eur(c.price * c.qty)}</b>
                  <button onClick={() => setCart(cart.filter((x) => x.id !== c.id))} className="text-red-500">✕</button></span>
              </li>
            ))}
          </ul>
          {cart.length === 0 && <p className="py-4 text-sm text-slate-400">Warenkorb leer.</p>}
          <dl className="mt-3 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><dt>Brutto</dt><dd className="font-bold">{eur(gross)}</dd></div>
            <div className="flex justify-between text-slate-500"><dt>MwSt. 19%</dt><dd>{eur(tax)}</dd></div>
            <div className="flex justify-between text-slate-500"><dt>Plattform 5% + 0,30€</dt><dd>{eur(commission)}</dd></div>
            <div className="flex justify-between font-extrabold"><dt>Netto an Sie</dt><dd className="text-emerald-600">{eur(net)}</dd></div>
          </dl>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[["cash", "💵 Bar"], ["terminal", "💳 Terminal"], ["online", "🌐 Online"]].map(([v, l]) => (
              <button key={v} onClick={() => setMethod(v)} className={`rounded-xl py-3 text-sm font-semibold ${method === v ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>{l}</button>
            ))}
          </div>
          <button disabled={loading || !cart.length} onClick={checkout} className="mt-3 w-full rounded-2xl bg-blue-600 py-4 text-base font-bold text-white disabled:opacity-50">
            {method === "terminal" ? "💳 An Terminal senden & bezahlen" : "Bezahlen — " + eur(gross)}
          </button>
          {result ? <pre className="mt-3 max-h-48 overflow-auto rounded-2xl bg-slate-100 p-3 text-xs dark:bg-slate-800">{JSON.stringify(result, null, 2)}</pre> : null}
        </div>
      </div>
    </div>
  );
}

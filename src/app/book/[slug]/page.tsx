"use client";
import { use, useEffect, useState } from "react";

type Svc = { id: string; name: string; duration_minutes: number; price_cents: number };

export default function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [business, setBusiness] = useState("");
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", starts_at: "", service_id: "" });
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/info?slug=${slug}`).then((r) => r.json()).then((d) => { setBusiness(d.business ?? ""); setSvcs(d.services ?? []); }).catch(() => {});
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/public/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, customer_name: form.customer_name, customer_email: form.customer_email || undefined, starts_at: new Date(form.starts_at).toISOString(), service_id: form.service_id || undefined }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setDone(true); setMsg(`✓ Vielen Dank, ${form.customer_name}! Ihr Termin bei ${d.business} ist gebucht. Sie erhalten eine Erinnerung 24h und 1h vorher.`); }
    else setMsg("❌ " + (d.error || "Fehler"));
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Öffentliche Buchung · Endkunde</p>
        <h1 className="mt-2 text-2xl font-extrabold">{business || "Termin buchen"}</h1>
        <p className="mt-1 text-sm text-slate-500">Kein Login nötig. Wählen Sie Service & Zeitpunkt — der Inhaber erhält sofort eine Benachrichtigung.</p>
        {done ? (
          <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-center dark:bg-emerald-950"><p className="text-4xl">✅</p><p className="mt-2 font-bold">{msg}</p><p className="mt-2 text-sm text-slate-500">Sie können dieses Fenster schließen.</p></div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Ihr Name *" className="w-full rounded-xl border border-slate-300 px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
            <input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} placeholder="E-Mail (für Erinnerung)" className="w-full rounded-xl border border-slate-300 px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
            <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
              <option value="">Service wählen (optional)</option>
              {svcs.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} Min · {(s.price_cents / 100).toFixed(2)}€</option>)}
            </select>
            <input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-3 dark:border-slate-700 dark:bg-slate-950" />
            {msg && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
            <button className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white">Termin verbindlich buchen →</button>
            <p className="text-center text-xs text-slate-400">DSGVO: Ihre Daten werden nur für diesen Termin verwendet.</p>
          </form>
        )}
      </div>
    </main>
  );
}

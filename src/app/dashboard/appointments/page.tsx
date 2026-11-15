"use client";
import { useEffect, useState } from "react";

type Appt = { id: string; customer_name: string; starts_at: string; ends_at: string; status: string; source: string | null; notes: string | null };
type Svc = { id: string; name: string; duration_minutes: number; price_cents: number };
type Ticket = { id: string; number: number; status: string; patient_name: string | null };

export default function AppointmentsPage() {
  const [appts, setAppts] = useState<Appt[]>([]);
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", starts_at: "", service_id: "", duration_minutes: 30, notes: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);
  async function load() {
    const [a, s, t] = await Promise.all([fetch("/api/appointments-list").then((r) => r.json()).catch(() => []), fetch("/api/services-list").then((r) => r.json()).catch(() => []), fetch("/api/tickets-list").then((r) => r.json()).catch(() => [])]);
    setAppts(a); setSvcs(s); setTickets(t);
  }
  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, starts_at: new Date(form.starts_at).toISOString(), service_id: form.service_id || undefined }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "✓ Termin erstellt. Erinnerung 24h & 1h wird automatisch versendet (E-Mail/SMS/WhatsApp)." : "❌ " + (d.error || "Fehler"));
    if (res.ok) { setForm({ customer_name: "", customer_email: "", starts_at: "", service_id: "", duration_minutes: 30, notes: "" }); load(); }
  }
  async function queue(action: string) {
    await fetch("/api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold">📅 Termine & Buchung</h1><p className="text-sm text-slate-500">Konflikt-Schutz inklusive. Öffentlicher Link: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/book/[slug]</code> — Endkunden buchen ohne Login.</p></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={create} className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold">Neuer Termin</h2>
          <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Kundenname *" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
          <input value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} placeholder="E-Mail (für Erinnerung)" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
          <div className="grid grid-cols-2 gap-3">
            <input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
            <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
              <option value="">Service (optional)</option>
              {svcs.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes}min · {(s.price_cents / 100).toFixed(2)}€</option>)}
            </select>
          </div>
          <input type="number" min={5} max={480} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} placeholder="Dauer (Minuten)" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
          {msg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm dark:bg-blue-950">{msg}</p>}
          <button className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">Termin erstellen</button>
        </form>
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-bold">🩺 Warteschlange (Praxis)</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {tickets.map((t) => <span key={t.id} className={`rounded-2xl px-4 py-2 font-bold ${t.status === "called" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 dark:bg-slate-800"}`}>#{t.number} {t.patient_name ?? ""} · {t.status}</span>)}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => queue("new")} className="flex-1 rounded-xl bg-slate-900 py-3 font-semibold text-white dark:bg-white dark:text-slate-900">+ Neue Nummer</button>
              <button onClick={() => queue("next")} className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white">📢 Nächste aufrufen</button>
              <button onClick={() => queue("done")} className="rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-700">Fertig</button>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-bold">Kommende Termine</h2>
            <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
              {appts.map((a) => (
                <li key={a.id} className="py-2.5 text-sm">
                  <div className="flex justify-between"><b>{a.customer_name}</b><span className="text-slate-500">{new Date(a.starts_at).toLocaleString("de-DE")}</span></div>
                  <p className="text-xs text-slate-400">{a.status} · Quelle: {a.source} {a.notes ? `· ${a.notes}` : ""}</p>
                </li>
              ))}
            </ul>
            {appts.length === 0 && <p className="py-4 text-sm text-slate-400">Noch keine Termine.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Tenant = { id: string; name: string; slug: string; profession: string; status: string; plan: string; monthly_fee_cents: number; commission_percent: number | null; commission_fixed_cents: number | null; created_at: string };
type Audit = { id: string; action: string; entity: string; entity_id: string | null; created_at: string; actor_id: string | null };
type Stats = { tenants: number; revenue: number; commissions: number; pastDue: number; suspended: number };

const PROFESSIONS = ["fahrschule", "friseur", "kiosk", "design", "steuerbuero", "bekleidung", "praxis", "apotheke", "kuenstler", "restaurant", "beauty", "buchhandlung", "schule", "baeckerei"];

export default function RootPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [form, setForm] = useState({ name: "", profession: "friseur", owner_email: "", owner_password: "", owner_name: "", plan: "pro" });
  const [msg, setMsg] = useState("");

  useEffect(() => { load(); }, []);
  async function load() {
    const [t, a, s] = await Promise.all([
      fetch("/api/root/tenants").then((r) => r.json()).catch(() => []),
      fetch("/api/root/audit").then((r) => r.json()).catch(() => []),
      fetch("/api/root/stats").then((r) => r.json()).catch(() => null),
    ]);
    setTenants(t); setAudits(a); setStats(s);
  }
  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch("/api/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? `✓ Geschäft erstellt: ${d.tenant.name} · Login: ${d.owner_email} · Buchungslink: ${d.booking_url}` : "❌ " + (d.error || "Fehler"));
    if (res.ok) load();
  }
  async function patch(id: string, status: string) {
    await fetch("/api/tenants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenant_id: id, status }) });
    load();
  }
  const eur = (c: number) => (c / 100).toFixed(2) + " €";

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold">👑 Plattform-Admin (Root)</h1><p className="text-sm text-slate-500">Absolute Kontrolle: Tenants, Abonnements, Provisionen, Features, Audit-Log, Impersonation.</p></div>
        <div className="flex gap-2">
          <Link href="/" className="rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">Website</Link>
          <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Abmelden</button>
        </div>
      </header>

      {stats && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[["Geschäfte", String(stats.tenants)], ["Monatsumsatz (alle)", eur(stats.revenue)], ["Provisionen gesamt", eur(stats.commissions)], ["Überfällig", String(stats.pastDue)], ["Gesperrt", String(stats.suspended)]].map(([l, v]) => (
            <div key={l} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs uppercase text-slate-500">{l}</p><p className="mt-1 text-2xl font-extrabold">{v}</p></div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <form onSubmit={create} className="h-fit space-y-3 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold">➕ Geschäft manuell erstellen</h2>
          <p className="text-xs text-slate-500">Branche wählen → Benutzername & Passwort → Features aktivieren. Automatische Sperrung bei Nichtzahlung (Grace Period einstellbar).</p>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Geschäftsname *" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
          <select value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
            {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input required value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Inhaber Name *" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
          <input required type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} placeholder="Inhaber E-Mail *" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
          <input required type="password" value={form.owner_password} onChange={(e) => setForm({ ...form, owner_password: e.target.value })} placeholder="Passwort (min. 8) *" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
          <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
            <option value="starter">Starter</option><option value="pro">Pro</option><option value="business">Business</option>
          </select>
          {msg && <p className="text-sm">{msg}</p>}
          <button className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white">Geschäft erstellen</button>
        </form>

        <div className="space-y-6">
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <h2 className="p-5 pb-0 font-bold">🏪 Alle Geschäfte (Tenants)</h2>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500"><tr><th className="p-3 text-start">Geschäft</th><th className="p-3 text-start">Branche</th><th className="p-3 text-start">Status</th><th className="p-3 text-start">Provision</th><th className="p-3 text-start">Aktionen</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="p-3"><b>{t.name}</b><span className="block text-xs text-slate-400">/book/{t.slug} · {eur(t.monthly_fee_cents)}/Monat</span></td>
                    <td className="p-3">{t.profession}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${t.status === "active" ? "bg-emerald-100 text-emerald-700" : t.status === "suspended" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{t.status}</span></td>
                    <td className="p-3">{((t.commission_percent ?? 500) / 100).toFixed(2)}% + {eur(t.commission_fixed_cents ?? 30)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {t.status === "active" ? <button onClick={() => patch(t.id, "suspended")} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white">Sperren</button> : <button onClick={() => patch(t.id, "active")} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Aktivieren</button>}
                        <Link href={`/book/${t.slug}`} className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700">Buchung</Link>
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800" title="Impersonation wird im Audit-Log protokolliert">👁 Impersonation</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tenants.length === 0 && <p className="p-6 text-center text-sm text-slate-400">Keine Tenants.</p>}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-bold">📋 Audit-Log (letzte 20)</h2>
            <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {audits.map((a) => (
                <li key={a.id} className="py-2"><b>{a.action}</b> <span className="text-slate-400">{a.entity} {a.entity_id?.slice(0, 8)}</span><span className="block text-xs text-slate-400">{new Date(a.created_at).toLocaleString("de-DE")} · Actor {a.actor_id?.slice(0, 8)}</span></li>
              ))}
            </ul>
            {audits.length === 0 && <p className="py-4 text-sm text-slate-400">Noch keine Einträge.</p>}
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const [tenant, setTenant] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then(setTenant).catch(() => {}); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commission_percent_bp: Number(fd.get("percent")) * 100, commission_fixed_cents: Math.round(Number(fd.get("fixed")) * 100), tax_rate_bp: Number(fd.get("tax")) * 100, terminal_id: String(fd.get("terminal") || "") }) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? "✓ Gespeichert. Änderungen gelten nur für neue Transaktionen (Audit-Log)." : "❌ " + (d.error || "Fehler"));
    if (res.ok) setTenant(d.tenant);
  }
  if (!tenant) return <p className="text-sm text-slate-500">Lädt…</p>;
  return (
    <div className="max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-extrabold">⚙️ Einstellungen</h1><p className="text-sm text-slate-500">Provision & MwSt. werden pro Transaktion als Snapshot gespeichert. Stripe Terminal / SumUp: Terminal-ID hier verbinden — Beträge gehen nur auf Ihr Konto (Stripe Connect).</p></div>
      <form onSubmit={save} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Provision %<input name="percent" type="number" step="0.01" defaultValue={((tenant.commission_percent as number) ?? 500) / 100} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
          <label className="text-sm">Fix €<input name="fixed" type="number" step="0.01" defaultValue={((tenant.commission_fixed_cents as number) ?? 30) / 100} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
          <label className="text-sm">MwSt. %<input name="tax" type="number" step="1" defaultValue={((tenant.tax_rate_bp as number) ?? 1900) / 100} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
          <label className="text-sm">Terminal-ID (Stripe/SumUp)<input name="terminal" defaultValue={(tenant.terminal_id as string) ?? ""} placeholder="TERM-…" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" /></label>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-xs dark:bg-slate-800">
          <p>USt-IdNr.: {String(tenant.ust_idnr ?? "—")} · Steuernummer: {String(tenant.steuernummer ?? "—")}</p>
          <p>TSE-Seriennummer (Fiskaly): {String(tenant.tse_serial ?? "—")} · Stripe Account: {String(tenant.stripe_account_id ?? "nicht verbunden")}</p>
          <p>Öffentlicher Buchungslink: <code>/book/{String(tenant.slug ?? "")}</code></p>
        </div>
        {msg && <p className="text-sm">{msg}</p>}
        <button className="rounded-xl bg-blue-600 px-5 py-2.5 font-semibold text-white">Speichern</button>
      </form>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-bold">🔒 Sicherheit & DSGVO</h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-slate-500">
          <li>Passwörter: bcrypt (12 Runden) · 2FA für Root/Super Admin verpflichtend</li>
          <li>DSGVO: Datenexport & Löschung auf Anfrage · Aufbewahrungsfristen für Rechnungen (GoBD: 10 Jahre)</li>
          <li>Praxis-Daten (Art. 9 DSGVO) & Schüler-Daten (Minderjährige): strengere Berechtigungen</li>
          <li>Tägliches automatisches DB-Backup (Cron) · Rate Limiting · CSRF · CSP/HSTS Headers</li>
        </ul>
      </div>
    </div>
  );
}

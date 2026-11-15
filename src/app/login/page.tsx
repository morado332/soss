"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DEMOS = [
  { label: "👑 Root (Plattform)", email: "root@platform.de", pw: "Root123!" },
  { label: "🚗 Fahrschule Inhaber", email: "owner@fahrschule.de", pw: "Owner123!" },
  { label: "✂️ Friseur Inhaber", email: "owner@friseur.de", pw: "Owner123!" },
  { label: "🛒 Kiosk Inhaber", email: "owner@kiosk.de", pw: "Owner123!" },
  { label: "🧾 Steuerberater ACC-1001", email: "accountant@kanzlei.de", pw: "Account123!" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@friseur.de");
  const [password, setPassword] = useState("Owner123!");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) { setError(data.error || "Login fehlgeschlagen"); return; }
    router.push(data.role === "root" || data.role === "super_admin" ? "/root" : "/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl place-items-center px-4 py-10">
      <div className="grid w-full gap-8 lg:grid-cols-2">
        <div>
          <Link href="/" className="font-extrabold text-xl">Arena<span className="text-blue-600">.</span></Link>
          <h1 className="mt-6 text-4xl font-extrabold">Anmelden</h1>
          <p className="mt-2 text-slate-500">2FA ist für Root & Super Admin verpflichtend. Passwörter werden mit bcrypt (12 Runden) gespeichert.</p>
          <form onSubmit={submit} className="mt-8 space-y-4 rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <label className="block text-sm font-medium">E-Mail
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            <label className="block text-sm font-medium">Passwort
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950" />
            </label>
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-50">{loading ? "…" : "Anmelden →"}</button>
          </form>
        </div>
        <div className="rounded-3xl bg-slate-900 p-6 text-white">
          <h2 className="font-bold">Demo-Zugänge (1 Klick)</h2>
          <p className="mt-1 text-sm text-slate-400">Jeder Zugang sieht nur seine eigenen Daten (Tenant-Isolation).</p>
          <div className="mt-4 space-y-2">
            {DEMOS.map((d) => (
              <button key={d.email} onClick={() => { setEmail(d.email); setPassword(d.pw); }} className="flex w-full items-center justify-between rounded-2xl bg-slate-800 px-4 py-3 text-start hover:bg-slate-700">
                <span className="font-medium">{d.label}</span><span className="text-xs text-slate-400">{d.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">Nach Auswahl „Anmelden“ klicken. Root sieht alle 14 Tenants, der Steuerberater nur seine Mandanten.</p>
        </div>
      </div>
    </main>
  );
}

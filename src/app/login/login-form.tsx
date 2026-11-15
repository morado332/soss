"use client";
import { useState } from "react";
import { LogIn } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api } from "@/lib/client";
import { Alert, Field, btnPrimary, cx, inputCls } from "@/components/ui";

const DEMOS = [
  { label: "✂️ Friseur · Inhaber", email: "owner@friseur.de" },
  { label: "🛒 Kiosk · Inhaber", email: "owner@kiosk.de" },
  { label: "🩺 Praxis · Inhaber", email: "owner@praxis.de" },
  { label: "🚗 Fahrschule · Inhaber", email: "owner@fahrschule.de" },
  { label: "💳 Friseur · Kasse", email: "staff@friseur.de" },
  { label: "🧾 Steuerberater", email: "accountant@kanzlei.de" },
];

export default function LoginForm({ demo }: { demo: boolean }) {
  const { t, err } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const r = await api<{ redirect: string }>("/api/auth/login", "POST", { email, password });
    if (!r.ok) { setLoading(false); setError(err(r.data.error)); return; }
    window.location.href = r.data.redirect === "/root" ? "/root" : "/dashboard";
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("loginTitle")}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("loginSub")}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label={t("email")}><input required type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={cx(inputCls, "h-11")} /></Field>
        <Field label={t("password")}><input required type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={cx(inputCls, "h-11")} /></Field>
        {error && <Alert tone="error">{error}</Alert>}
        <button disabled={loading} className={cx(btnPrimary, "h-11 w-full")}><LogIn className="h-4 w-4 rtl:rotate-180" />{loading ? t("loading") : t("loginBtn")}</button>
      </form>
      {demo && (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-700">
          <p className="text-sm font-medium">{t("demoAccounts")}</p>
          <p className="mt-0.5 text-xs text-slate-500">{t("demoAccountsHint")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMOS.map((d) => (
              <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword("Demo12345!"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-start text-xs font-medium hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700">
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

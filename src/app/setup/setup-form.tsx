"use client";
import { useState } from "react";
import { ShieldCheck, TriangleAlert, Terminal } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api } from "@/lib/client";
import { Alert, Field, btnPrimary, cx, inputCls } from "@/components/ui";

export default function SetupForm({ tokenFromEnv }: { tokenFromEnv: boolean }) {
  const { t, err } = useI18n();
  const [f, setF] = useState({ token: "", name: "", email: "", password: "", repeat: "", demo: false });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (f.password !== f.repeat) return setMsg({ tone: "error", text: t("passwordMismatch") });
    setBusy(true);
    const r = await api("/api/setup", "POST", { token: f.token.trim(), name: f.name, email: f.email, password: f.password, demo: f.demo });
    if (!r.ok) { setBusy(false); return setMsg({ tone: "error", text: err(r.data.error) }); }
    setMsg({ tone: "success", text: t("setupDone") });
    window.location.href = "/root";
  }

  return (
    <div>
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"><ShieldCheck className="h-6 w-6" /></span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{t("setupTitle")}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t("setupSub")}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label={t("setupToken")} hint={<span className="inline-flex items-center gap-1"><Terminal className="h-3 w-3" />{tokenFromEnv ? t("setupTokenHint") : t("setupTokenLog")}</span>}>
          <input required autoComplete="off" value={f.token} onChange={(e) => setF({ ...f, token: e.target.value })} className={cx(inputCls, "font-mono")} />
        </Field>
        <Field label={t("name")}><input required minLength={2} maxLength={120} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
        <Field label={t("email")}><input required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></Field>
        <Field label={t("password")} hint={t("passwordRules")}><input required type="password" minLength={10} maxLength={72} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={inputCls} /></Field>
        <Field label={t("passwordRepeat")}><input required type="password" autoComplete="new-password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} className={inputCls} /></Field>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <input type="checkbox" checked={f.demo} onChange={(e) => setF({ ...f, demo: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600" />
          <span><span className="block text-sm font-medium">{t("demoData")}</span><span className="mt-0.5 flex gap-1 text-xs text-amber-700 dark:text-amber-400"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />{t("demoDataHint")}</span></span>
        </label>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <button disabled={busy} className={cx(btnPrimary, "h-11 w-full")}>{busy ? t("loading") : t("setupSubmit")}</button>
      </form>
    </div>
  );
}

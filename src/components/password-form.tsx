"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useI18n } from "./providers";
import { api } from "@/lib/client";
import { Alert, Field, btnPrimary, inputCls } from "./ui";

export function PasswordForm() {
  const { t, err } = useI18n();
  const [f, setF] = useState({ current: "", next: "", repeat: "" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (f.next !== f.repeat) return setMsg({ tone: "error", text: t("passwordMismatch") });
    const r = await api("/api/auth/password", "POST", { current: f.current, next: f.next });
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("s_pwChanged") });
    setTimeout(() => { window.location.href = "/login"; }, 1500);
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={t("s_currentPw")}><input required type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} className={inputCls} /></Field>
      <Field label={t("s_newPw")} hint={t("passwordRules")}><input required type="password" autoComplete="new-password" minLength={10} maxLength={72} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} className={inputCls} /></Field>
      <Field label={t("passwordRepeat")}><input required type="password" autoComplete="new-password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} className={inputCls} /></Field>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <button className={btnPrimary}><KeyRound className="h-4 w-4" />{t("s_changePw")}</button>
    </form>
  );
}

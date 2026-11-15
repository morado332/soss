"use client";
import { useState } from "react";
import { CircleCheck, CalendarCheck } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, nowMs } from "@/lib/client";
import { Alert, Field, btnPrimary, btnSecondary, cx, inputCls } from "@/components/ui";

type Svc = { id: string; name: string; duration_minutes: number; price_cents: number };
const empty = { customer_name: "", customer_email: "", customer_phone: "", starts_at: "", service_id: "", website: "" };

export default function BookingForm({ slug, business, services }: { slug: string; business: string; services: Svc[] }) {
  const { t, err, locale } = useI18n();
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState<{ name: string; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const minDate = (() => { const d = new Date(nowMs() + 60 * 60_000); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); })();

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setBusy(true);
    const r = await api<{ starts_at: string }>("/api/public/book", "POST", {
      slug, customer_name: f.customer_name, customer_email: f.customer_email, customer_phone: f.customer_phone || undefined,
      starts_at: new Date(f.starts_at).toISOString(), service_id: f.service_id || undefined, ...(f.website ? { website: f.website } : {}),
    });
    setBusy(false);
    if (!r.ok) return setMsg(err(r.data.error));
    setDone({ name: f.customer_name, date: new Date(r.data.starts_at).toLocaleString(locale, { dateStyle: "full", timeStyle: "short" }) });
    setF(empty);
  }

  if (done) return (
    <div className="p-10 text-center">
      <CircleCheck className="mx-auto h-14 w-14 text-emerald-500" />
      <p className="mt-4 text-lg font-semibold">{t("b_success", { name: done.name })}</p>
      <p className="mt-2 text-sm text-slate-500">{t("b_successSub", { business, date: done.date })}</p>
      <button onClick={() => setDone(null)} className={cx(btnSecondary, "mt-6")}>{t("b_another")}</button>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4 p-6">
      {services.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{t("b_service")}</legend>
          <div className="grid gap-2">
            {services.map((s) => (
              <label key={s.id} className={cx("flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition", f.service_id === s.id ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800")}>
                <span className="flex items-center gap-3"><input type="radio" name="svc" value={s.id} checked={f.service_id === s.id} onChange={() => setF({ ...f, service_id: s.id })} className="h-4 w-4 text-indigo-600" /><span><span className="font-medium">{s.name}</span><span className="block text-xs text-slate-500">{s.duration_minutes} {t("minutes")}</span></span></span>
                {s.price_cents > 0 && <span className="tabular font-semibold">{money(s.price_cents)}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Field label={t("b_time")}><input required type="datetime-local" min={minDate} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} className={inputCls} /></Field>
      <Field label={t("b_name")}><input required minLength={2} maxLength={120} autoComplete="name" value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} className={inputCls} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("b_email")}><input required type="email" autoComplete="email" value={f.customer_email} onChange={(e) => setF({ ...f, customer_email: e.target.value })} className={inputCls} /></Field>
        <Field label={t("b_phone")}><input type="tel" maxLength={40} autoComplete="tel" value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} className={inputCls} /></Field>
      </div>
      {/* Honeypot against spam bots — hidden from humans */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden />
      {msg && <Alert tone="error">{msg}</Alert>}
      <button disabled={busy} className={cx(btnPrimary, "h-12 w-full text-base")}><CalendarCheck className="h-5 w-5" />{busy ? t("loading") : t("b_submit")}</button>
      <p className="text-center text-xs text-slate-400">{t("b_privacy")}</p>
    </form>
  );
}

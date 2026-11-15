"use client";
import { useCallback, useState } from "react";
import { CalendarPlus, CalendarDays, Ticket, Megaphone, Check, Plus, Trash2, ExternalLink } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, btnPrimary, btnSecondary, btnSm, btnGhost, cx, inputCls, statusTone } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Appt = { id: string; customer_name: string; customer_email: string | null; customer_phone: string | null; starts_at: string; ends_at: string; status: string; source: string | null; notes: string | null; service_name: string | null };
type Svc = { id: string; name: string; duration_minutes: number; price_cents: number };
type TicketT = { id: string; number: number; status: string; patient_name: string | null };

const emptyForm = { customer_name: "", customer_email: "", customer_phone: "", starts_at: "", service_id: "", duration_minutes: 30, notes: "" };

export default function AppointmentsClient({ canWrite, showQueue, slug }: { canWrite: boolean; showQueue: boolean; slug: string }) {
  const { t, err, locale } = useI18n();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [tickets, setTickets] = useState<TicketT[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [svcForm, setSvcForm] = useState({ name: "", duration_minutes: 30, price: "" });
  const [patient, setPatient] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });

  const load = useCallback(async () => {
    const [a, s, q] = await Promise.all([api<Appt[]>("/api/appointments"), api<Svc[]>("/api/services"), showQueue ? api<TicketT[]>("/api/queue") : Promise.resolve(null)]);
    if (a.ok) setAppts(a.data as unknown as Appt[]);
    if (s.ok) setSvcs(s.data as unknown as Svc[]);
    if (q?.ok) setTickets(q.data as unknown as TicketT[]);
  }, [showQueue]);
  useLoader(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setBusy(true);
    const r = await api("/api/appointments", "POST", {
      customer_name: form.customer_name, customer_email: form.customer_email || undefined, customer_phone: form.customer_phone || undefined,
      starts_at: new Date(form.starts_at).toISOString(), service_id: form.service_id || undefined, duration_minutes: Number(form.duration_minutes), notes: form.notes || undefined,
    });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("a_created") }); setForm(emptyForm); load();
  }
  async function setStatus(id: string, status: string) {
    const r = await api("/api/appointments", "PATCH", { id, status });
    if (!r.ok) setMsg({ tone: "error", text: err(r.data.error) });
    load();
  }
  async function queue(action: "new" | "next" | "done") {
    const r = await api("/api/queue", "POST", { action, patient_name: action === "new" ? patient || undefined : undefined });
    if (!r.ok) setMsg({ tone: "error", text: err(r.data.error) });
    setPatient(""); load();
  }
  async function addService(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("/api/services", "POST", { name: svcForm.name, duration_minutes: Number(svcForm.duration_minutes), price_cents: Math.round(Number(svcForm.price || 0) * 100) });
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setSvcForm({ name: "", duration_minutes: 30, price: "" }); load();
  }
  async function removeService(id: string) {
    await api(`/api/services?id=${id}`, "DELETE"); load();
  }

  const now = nowMs();
  const upcoming = appts.filter((a) => new Date(a.ends_at).getTime() >= now).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const past = appts.filter((a) => new Date(a.ends_at).getTime() < now).slice(0, 20);
  const called = tickets.find((x) => x.status === "called");
  const waiting = tickets.filter((x) => x.status === "waiting");
  const fmt = (d: string) => new Date(d).toLocaleString(locale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const row = (a: Appt, actions: boolean) => (
    <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
      <div className="tabular w-36 shrink-0 text-sm font-medium text-slate-900 dark:text-white">{fmt(a.starts_at)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{a.customer_name}</p>
        <p className="truncate text-xs text-slate-500">{[a.service_name, a.customer_email, a.customer_phone, t(`src_${a.source ?? "dashboard"}` as DictKey), a.notes].filter(Boolean).join(" · ")}</p>
      </div>
      <Badge tone={statusTone(a.status)}>{t(`st_${a.status}` as DictKey)}</Badge>
      {actions && canWrite && (a.status === "scheduled" || a.status === "confirmed") && (
        <div className="flex gap-1">
          {a.status === "scheduled" && <button onClick={() => setStatus(a.id, "confirmed")} className={cx(btnSecondary, btnSm)}>{t("a_confirm")}</button>}
          <button onClick={() => setStatus(a.id, "completed")} className={cx(btnSecondary, btnSm)}><Check className="h-3.5 w-3.5" /></button>
          <button onClick={() => setStatus(a.id, "cancelled")} className={cx(btnGhost, btnSm, "text-red-600")}>{t("a_cancel")}</button>
        </div>
      )}
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("a_title")} description={t("a_sub")} actions={<a href={`/book/${slug}`} target="_blank" rel="noopener noreferrer" className={btnSecondary}><ExternalLink className="h-4 w-4" />{t("bookingLink")}</a>} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          {canWrite && (
            <Card title={<span className="flex items-center gap-2"><CalendarPlus className="h-4 w-4" />{t("a_new")}</span>}>
              <form onSubmit={create} className="space-y-3">
                <Field label={`${t("a_customerName")} *`}><input required maxLength={200} value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className={inputCls} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("email")}><input type="email" maxLength={254} value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} className={inputCls} /></Field>
                  <Field label={t("a_phone")}><input type="tel" maxLength={50} value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className={inputCls} /></Field>
                </div>
                <Field label={`${t("a_start")} *`}><input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className={inputCls} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("a_service")}>
                    <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })} className={inputCls}>
                      <option value="">{t("a_noService")}</option>
                      {svcs.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration_minutes} {t("minutes")}</option>)}
                    </select>
                  </Field>
                  <Field label={t("a_duration")}><input type="number" min={5} max={480} disabled={!!form.service_id} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} className={inputCls} /></Field>
                </div>
                <Field label={t("a_notes")}><textarea rows={2} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></Field>
                <button disabled={busy} className={cx(btnPrimary, "w-full")}>{t("create")}</button>
              </form>
            </Card>
          )}

          {showQueue && (
            <Card title={<span className="flex items-center gap-2"><Ticket className="h-4 w-4" />{t("q_title")}</span>} description={t("q_waiting", { n: waiting.length })}>
              <div className="rounded-lg bg-slate-50 p-4 text-center dark:bg-slate-800/60">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t("q_now")}</p>
                <p className="tabular mt-1 text-4xl font-bold text-indigo-600 dark:text-indigo-400">{called ? `#${called.number}` : "—"}</p>
                {called?.patient_name && <p className="text-sm text-slate-600 dark:text-slate-300">{called.patient_name}</p>}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {waiting.length === 0 ? <p className="text-sm text-slate-500">{t("q_empty")}</p> : waiting.map((x) => <Badge key={x.id} tone="amber">#{x.number} {x.patient_name ?? ""}</Badge>)}
              </div>
              {canWrite && (
                <div className="mt-4 space-y-2">
                  <div className="flex gap-2">
                    <input value={patient} onChange={(e) => setPatient(e.target.value)} maxLength={120} placeholder={t("q_patient")} className={inputCls} />
                    <button onClick={() => queue("new")} className={btnSecondary}><Plus className="h-4 w-4" />{t("q_new")}</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => queue("next")} className={btnPrimary}><Megaphone className="h-4 w-4" />{t("q_next")}</button>
                    <button onClick={() => queue("done")} className={btnSecondary}><Check className="h-4 w-4" />{t("q_done")}</button>
                  </div>
                </div>
              )}
            </Card>
          )}

          <Card title={t("svc_title")}>
            {svcs.length === 0 ? <p className="text-sm text-slate-500">{t("svc_none")}</p> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {svcs.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 truncate">{s.name} <span className="text-slate-400">· {s.duration_minutes} {t("minutes")}</span></span>
                    <span className="flex items-center gap-2"><span className="tabular font-medium">{money(s.price_cents)}</span>
                      {canWrite && <button onClick={() => removeService(s.id)} className="text-slate-400 hover:text-red-600" aria-label={t("delete")}><Trash2 className="h-4 w-4" /></button>}</span>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <form onSubmit={addService} className="mt-4 grid grid-cols-[1fr_70px_80px_auto] gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <input required maxLength={200} placeholder={t("svc_new")} value={svcForm.name} onChange={(e) => setSvcForm({ ...svcForm, name: e.target.value })} className={inputCls} />
                <input type="number" min={5} max={480} title={t("a_duration")} value={svcForm.duration_minutes} onChange={(e) => setSvcForm({ ...svcForm, duration_minutes: Number(e.target.value) })} className={inputCls} />
                <input type="number" min={0} step="0.01" placeholder="€" title={t("svc_price")} value={svcForm.price} onChange={(e) => setSvcForm({ ...svcForm, price: e.target.value })} className={inputCls} />
                <button className={btnSecondary} aria-label={t("add")}><Plus className="h-4 w-4" /></button>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={t("a_upcoming")} padded={false}>
            {upcoming.length === 0 ? <div className="p-5"><Empty icon={CalendarDays} text={t("a_none")} /></div> : <ul className="divide-y divide-slate-100 dark:divide-slate-800">{upcoming.map((a) => row(a, true))}</ul>}
          </Card>
          {past.length > 0 && (
            <Card title={t("a_past")} padded={false}>
              <ul className="divide-y divide-slate-100 opacity-80 dark:divide-slate-800">{past.map((a) => row(a, false))}</ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

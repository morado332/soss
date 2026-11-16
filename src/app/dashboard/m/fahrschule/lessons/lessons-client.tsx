"use client";
import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarClock, Check, X, Car, UserCheck } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, btnGhost, btnPrimary, btnSecondary, btnSm, cx, inputCls, statusTone } from "@/components/ui";
import { TYPE_KEYS, TYPE_TONE, typeLabel } from "@/modules/fahrschule/ui/shared";
import type { DictKey } from "@/lib/i18n";

type Lesson = { id: string; type: string; starts_at: string; ends_at: string; units: number; status: string; price_cents: number; invoice_id: string | null; student: string; instructor_id: string; instructor: string; vehicle: string | null; plate: string | null };
type Opt = { id: string; name: string; is_active?: boolean; plate?: string; status?: string };

const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const localInput = (d: Date) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 16); };

export default function LessonsClient({ canWrite }: { canWrite: boolean }) {
  const { t, err, locale } = useI18n();
  const [day, setDay] = useState(() => dayStart(new Date()));
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Opt[]>([]);
  const [instructors, setInstructors] = useState<Opt[]>([]);
  const [vehicles, setVehicles] = useState<Opt[]>([]);
  const [f, setF] = useState({ student_id: "", instructor_id: "", vehicle_id: "", type: "normal", units: 1, starts_at: "", price: "" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const time = (s: string) => new Date(s).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const loadDay = useCallback(async () => {
    const to = new Date(day.getTime() + 86_400_000);
    const r = await api<Lesson[]>(`/api/m/fahrschule/lessons?from=${encodeURIComponent(day.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
    if (r.ok) setLessons(r.data as unknown as Lesson[]);
  }, [day]);
  const loadRefs = useCallback(async () => {
    const [s, i, v] = await Promise.all([api<Opt[]>("/api/m/fahrschule/students"), api<Opt[]>("/api/m/fahrschule/instructors"), api<Opt[]>("/api/m/fahrschule/vehicles")]);
    if (s.ok) setStudents((s.data as unknown as Opt[]).filter((x) => x.status !== "finished"));
    if (i.ok) setInstructors((i.data as unknown as Opt[]).filter((x) => x.is_active !== false));
    if (v.ok) setVehicles((v.data as unknown as Opt[]).filter((x) => x.is_active !== false));
  }, []);
  useLoader(() => { loadDay(); }, [loadDay]);
  useLoader(() => { loadRefs(); setF((x) => ({ ...x, starts_at: x.starts_at || localInput(new Date(Math.ceil(Date.now() / 900_000) * 900_000)) })); }, [loadRefs]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    const r = await api("/api/m/fahrschule/lessons", "POST", {
      student_id: f.student_id, instructor_id: f.instructor_id, vehicle_id: f.vehicle_id || undefined, type: f.type, units: Number(f.units),
      starts_at: new Date(f.starts_at).toISOString(), price_cents: Math.round(Number(f.price || 0) * 100),
    });
    if (!r.ok) return setMsg({ tone: "error", text: err(r.data.error) });
    setMsg({ tone: "success", text: t("fs_lesson_created") });
    setDay(dayStart(new Date(f.starts_at)));
    loadDay();
  }
  async function setStatus(id: string, status: string) {
    const r = await api("/api/m/fahrschule/lessons", "PATCH", { id, status });
    if (!r.ok) setMsg({ tone: "error", text: err(r.data.error) });
    loadDay();
  }

  const busy = new Set(lessons.filter((l) => l.status !== "cancelled").map((l) => l.instructor_id));
  const isToday = dayStart(new Date()).getTime() === day.getTime();
  const ready = students.length > 0 && instructors.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("fs_nav_lessons")} description={t("fs_lessons_sub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          {canWrite && (
            <Card title={t("fs_new_lesson")}>
              {!ready ? <Empty icon={CalendarClock} text={t("fs_need_setup")} /> : (
                <form onSubmit={create} className="space-y-3">
                  <Field label={`${t("fs_student")} *`}>
                    <select required value={f.student_id} onChange={(e) => setF({ ...f, student_id: e.target.value })} className={inputCls}>
                      <option value="">—</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`${t("fs_instructor")} *`}>
                      <select required value={f.instructor_id} onChange={(e) => setF({ ...f, instructor_id: e.target.value })} className={inputCls}>
                        <option value="">—</option>{instructors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </Field>
                    <Field label={t("fs_vehicle")}>
                      <select value={f.vehicle_id} onChange={(e) => setF({ ...f, vehicle_id: e.target.value })} className={inputCls}>
                        <option value="">{t("fs_no_vehicle")}</option>{vehicles.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.plate}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={t("fs_type")}>
                      <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inputCls}>
                        {TYPE_KEYS.map((k) => <option key={k} value={k}>{t(typeLabel(k))}</option>)}
                      </select>
                    </Field>
                    <Field label={t("fs_duration")}>
                      <select value={f.units} onChange={(e) => setF({ ...f, units: Number(e.target.value) })} className={inputCls}>
                        <option value={1}>{t("fs_units_1")}</option><option value={2}>{t("fs_units_2")}</option><option value={3}>{t("fs_units_3")}</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label={`${t("a_start")} *`}><input required type="datetime-local" step={900} value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} className={inputCls} /></Field>
                    <Field label={t("fs_price")}><input type="number" min={0} max={1000} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className={inputCls} /></Field>
                  </div>
                  <button className={cx(btnPrimary, "w-full")}><CalendarClock className="h-4 w-4" />{t("create")}</button>
                </form>
              )}
            </Card>
          )}
          {isToday && (
            <Card title={t("fs_available")}>
              {instructors.length === 0 ? <p className="text-sm text-slate-500">{t("fs_none_instructors")}</p> : (
                <ul className="space-y-2">{instructors.map((i) => (
                  <li key={i.id} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2"><UserCheck className="h-4 w-4 text-slate-400" />{i.name}</span>
                    {busy.has(i.id) ? <Badge tone="amber">{t("fs_lessons_count", { n: lessons.filter((l) => l.instructor_id === i.id && l.status !== "cancelled").length })}</Badge> : <Badge tone="green">{t("fs_free")}</Badge>}</li>
                ))}</ul>
              )}
            </Card>
          )}
        </div>

        <Card padded={false} title={day.toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })} action={
          <div className="flex items-center gap-1">
            <button onClick={() => setDay(new Date(day.getTime() - 86_400_000))} className={cx(btnSecondary, btnSm)} aria-label="-1"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
            <button onClick={() => setDay(dayStart(new Date()))} className={cx(btnSecondary, btnSm)}>{t("fs_today")}</button>
            <button onClick={() => setDay(new Date(day.getTime() + 86_400_000))} className={cx(btnSecondary, btnSm)} aria-label="+1"><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
          </div>
        }>
          {lessons.length === 0 ? <div className="p-5"><Empty icon={CalendarClock} text={t("fs_no_lessons")} /></div> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {lessons.map((l) => (
                <li key={l.id} className={cx("flex flex-wrap items-center gap-3 px-5 py-3.5", l.status === "cancelled" && "opacity-50")}>
                  <span className={cx("h-10 w-1 shrink-0 rounded-full", TYPE_TONE[l.type] ?? "bg-slate-400")} aria-hidden />
                  <div className="tabular w-24 text-sm"><p className="font-semibold">{time(l.starts_at)}</p><p className="text-xs text-slate-500">– {time(l.ends_at)}</p></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.student}</p>
                    <p className="truncate text-xs text-slate-500">{t(typeLabel(l.type))} · {l.instructor}{l.vehicle ? <> · <Car className="inline h-3 w-3" /> {l.plate}</> : null}{l.price_cents ? ` · ${money(l.price_cents)}` : ""}</p>
                  </div>
                  <Badge tone={statusTone(l.status)}>{t(`st_${l.status}` as DictKey)}</Badge>
                  {canWrite && l.status === "scheduled" && (
                    <div className="flex gap-1">
                      <button onClick={() => setStatus(l.id, "completed")} className={cx(btnSecondary, btnSm)} title={t("st_completed")}><Check className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setStatus(l.id, "no_show")} className={cx(btnGhost, btnSm)}>{t("a_noshow")}</button>
                      <button onClick={() => setStatus(l.id, "cancelled")} className={cx(btnGhost, btnSm, "text-red-600")} title={t("a_cancel")}><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

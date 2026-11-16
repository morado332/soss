"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus, X, Search, ChevronRight } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, btnPrimary, btnSecondary, cx, inputCls } from "@/components/ui";
import { Progress, type StudentRow } from "@/modules/fahrschule/ui/shared";
import type { DictKey } from "@/lib/i18n";

type Opt = { id: string; name: string; is_active: boolean };
const empty = { name: "", email: "", phone: "", license_class: "B", instructor_id: "", theory_external_id: "" };

export default function StudentsClient({ canManage }: { canManage: boolean }) {
  const { t, err } = useI18n();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [instructors, setInstructors] = useState<Opt[]>([]);
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string>("");
  const load = useCallback(async () => {
    const [s, i] = await Promise.all([api<StudentRow[]>("/api/m/fahrschule/students"), api<Opt[]>("/api/m/fahrschule/instructors")]);
    if (s.ok) setRows(s.data as unknown as StudentRow[]);
    if (i.ok) setInstructors((i.data as unknown as Opt[]).filter((x) => x.is_active));
  }, []);
  useLoader(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await api("/api/m/fahrschule/students", "POST", { ...f, theory_external_id: f.theory_external_id || undefined, phone: f.phone || undefined });
    if (!r.ok) return setMsg(err(r.data.error));
    setF(empty); setOpen(false); load();
  }
  const shown = rows.filter((s) => !q || `${s.name} ${s.email ?? ""} ${s.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const tone = (s: string) => (s === "active" ? "blue" : s === "finished" ? "green" : "amber") as "blue" | "green" | "amber";

  return (
    <div className="space-y-6">
      <PageHeader title={t("fs_nav_students")} description={t("fs_students_sub")} actions={canManage ? <button onClick={() => setOpen((o) => !o)} className={btnPrimary}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? t("cancel") : t("fs_new_student")}</button> : undefined} />
      {msg && <Alert tone="error">{msg}</Alert>}
      {open && (
        <Card title={t("fs_new_student")}>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={`${t("name")} *`}><input required minLength={2} maxLength={120} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
            <Field label={t("email")}><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} /></Field>
            <Field label={t("a_phone")}><input type="tel" maxLength={40} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={inputCls} /></Field>
            <Field label={t("fs_license_class")}>
              <select value={f.license_class} onChange={(e) => setF({ ...f, license_class: e.target.value })} className={inputCls}>
                {["B", "B197", "BE", "A", "A1", "A2", "AM", "C", "CE"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label={t("fs_instructor")}>
              <select value={f.instructor_id} onChange={(e) => setF({ ...f, instructor_id: e.target.value })} className={inputCls}>
                <option value="">—</option>{instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <Field label={t("fs_theory_ext")}><input maxLength={100} pattern="[A-Za-z0-9_.\-]*" value={f.theory_external_id} onChange={(e) => setF({ ...f, theory_external_id: e.target.value })} className={inputCls} /></Field>
            <div className="sm:col-span-2 lg:col-span-3"><button className={btnPrimary}><GraduationCap className="h-4 w-4" />{t("create")}</button></div>
          </form>
        </Card>
      )}
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={cx(inputCls, "ps-9")} /></div>
      {shown.length === 0 ? <Empty icon={GraduationCap} text={t("fs_none_students")} /> : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((s) => (
            <Link key={s.id} href={`/dashboard/m/fahrschule/students/${s.id}`} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate font-semibold">{s.name}</p><p className="truncate text-xs text-slate-500">{t("fs_license_class")} {s.license_class} · {s.instructor ?? "—"}</p></div>
                <div className="flex items-center gap-1"><Badge tone={tone(s.status)}>{t(`fs_status_${s.status}` as DictKey)}</Badge><ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500 rtl:rotate-180" /></div>
              </div>
              <div className="mt-4 space-y-2.5">
                <Progress label={t("fs_type_normal")} done={s.done.normal} required={s.req_normal} />
                <div className="grid grid-cols-3 gap-3">
                  <Progress label={t("fs_type_ueberland")} done={s.done.ueberland} required={s.req_ueberland} />
                  <Progress label={t("fs_type_autobahn")} done={s.done.autobahn} required={s.req_autobahn} />
                  <Progress label={t("fs_type_nacht")} done={s.done.nacht} required={s.req_nacht} />
                </div>
                <Progress label={`${t("fs_theory")}${s.theory_passed ? " · ✓" : ""}`} done={s.theory_progress} required={100} tone="bg-violet-500" />
              </div>
              {s.done.unbilled > 0 && <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-400">{t("fs_open_unbilled", { n: s.done.unbilled })}</p>}
            </Link>
          ))}
        </div>
      )}
      {!canManage && <p className="text-xs text-slate-400">{t("s_ownerOnly")}</p>}
    </div>
  );
}

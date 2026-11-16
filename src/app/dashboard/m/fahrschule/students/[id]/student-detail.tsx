"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Receipt, Save } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, btnPrimary, btnSecondary, cx, inputCls, statusTone } from "@/components/ui";
import { Progress, typeLabel, type StudentRow } from "@/modules/fahrschule/ui/shared";
import type { DictKey } from "@/lib/i18n";

type Lesson = { id: string; type: string; starts_at: string; units: number; status: string; price_cents: number; invoice_id: string | null };

export default function StudentDetail({ id, canManage, canBill }: { id: string; canManage: boolean; canBill: boolean }) {
  const { t, err, locale } = useI18n();
  const [s, setS] = useState<StudentRow | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const load = useCallback(async () => {
    const r = await api<{ student: StudentRow; lessons: Lesson[] }>(`/api/m/fahrschule/students?id=${id}`);
    if (r.ok) { setS(r.data.student); setLessons(r.data.lessons); } else setMsg({ tone: "error", text: err(r.data.error) });
  }, [id, err]);
  useLoader(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!s) return;
    const r = await api("/api/m/fahrschule/students", "PATCH", {
      id, status: s.status, theory_progress: Number(s.theory_progress), theory_passed: s.theory_passed, practical_passed: s.practical_passed,
      req_normal: Number(s.req_normal), req_ueberland: Number(s.req_ueberland), req_autobahn: Number(s.req_autobahn), req_nacht: Number(s.req_nacht),
      theory_external_id: s.theory_external_id ?? "", notes: s.notes ?? "",
    });
    setMsg(r.ok ? { tone: "success", text: t("saved") } : { tone: "error", text: err(r.data.error) }); load();
  }
  async function bill() {
    const r = await api<{ invoice: { number: string } }>("/api/m/fahrschule/students/bill", "POST", { student_id: id });
    setMsg(r.ok ? { tone: "success", text: t("fs_billed", { number: r.data.invoice.number }) } : { tone: "error", text: err(r.data.error) }); load();
  }
  if (!s) return msg ? <Alert tone="error">{msg.text}</Alert> : <p className="text-sm text-slate-500">{t("loading")}</p>;
  const num = (k: keyof StudentRow) => (e: React.ChangeEvent<HTMLInputElement>) => setS({ ...s, [k]: Number(e.target.value) });

  return (
    <div className="space-y-6">
      <Link href="/dashboard/m/fahrschule/students" className={btnSecondary}><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t("fs_nav_students")}</Link>
      <PageHeader title={s.name} description={`${t("fs_license_class")} ${s.license_class} · ${s.instructor ?? "—"} · ${s.email ?? ""} ${s.phone ?? ""}`}
        actions={canBill && s.done.unbilled > 0 ? <button onClick={bill} className={btnPrimary}><Receipt className="h-4 w-4" />{t("fs_bill")} ({s.done.unbilled})</button> : undefined} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title={t("fs_home_progress")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Progress label={t("fs_type_normal")} done={s.done.normal} required={s.req_normal} />
              <Progress label={t("fs_type_ueberland")} done={s.done.ueberland} required={s.req_ueberland} />
              <Progress label={t("fs_type_autobahn")} done={s.done.autobahn} required={s.req_autobahn} />
              <Progress label={t("fs_type_nacht")} done={s.done.nacht} required={s.req_nacht} />
              <Progress label={t("fs_theory")} done={s.theory_progress} required={100} tone="bg-violet-500" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {s.theory_passed && <Badge tone="green">✓ {t("fs_theory_passed")}</Badge>}
              {s.practical_passed && <Badge tone="green">✓ {t("fs_practical_passed")}</Badge>}
            </div>
          </Card>
          <Card title={t("fs_history")} padded={false}>
            {lessons.length === 0 ? <div className="p-5"><Empty text={t("fs_no_lessons")} /></div> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {lessons.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="tabular w-36">{new Date(l.starts_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span>
                    <span className="flex-1">{t(typeLabel(l.type))} · {l.units * 45} {t("minutes")}</span>
                    {l.price_cents > 0 && <span className="tabular text-slate-500">{money(l.price_cents)}</span>}
                    {l.invoice_id && <Badge tone="violet">{t("i_invoice")}</Badge>}
                    <Badge tone={statusTone(l.status)}>{t(`st_${l.status}` as DictKey)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title={t("edit")}>
          <form onSubmit={save}>
            <fieldset disabled={!canManage} className="space-y-3">
              <Field label={t("status")}>
                <select value={s.status} onChange={(e) => setS({ ...s, status: e.target.value })} className={inputCls}>
                  {["active", "paused", "finished"].map((k) => <option key={k} value={k}>{t(`fs_status_${k}` as DictKey)}</option>)}
                </select>
              </Field>
              <p className="pt-2 text-xs font-medium uppercase tracking-wide text-slate-500">{t("fs_required")}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("fs_req_normal")}><input type="number" min={0} max={200} value={s.req_normal} onChange={num("req_normal")} className={inputCls} /></Field>
                <Field label={t("fs_type_ueberland")}><input type="number" min={0} max={200} value={s.req_ueberland} onChange={num("req_ueberland")} className={inputCls} /></Field>
                <Field label={t("fs_type_autobahn")}><input type="number" min={0} max={200} value={s.req_autobahn} onChange={num("req_autobahn")} className={inputCls} /></Field>
                <Field label={t("fs_type_nacht")}><input type="number" min={0} max={200} value={s.req_nacht} onChange={num("req_nacht")} className={inputCls} /></Field>
              </div>
              <Field label={`${t("fs_theory")} (%)`}><input type="number" min={0} max={100} value={s.theory_progress} onChange={num("theory_progress")} className={inputCls} /></Field>
              <Field label={t("fs_theory_ext")}><input maxLength={100} value={s.theory_external_id ?? ""} onChange={(e) => setS({ ...s, theory_external_id: e.target.value })} className={inputCls} /></Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.theory_passed} onChange={(e) => setS({ ...s, theory_passed: e.target.checked })} />{t("fs_theory_passed")}</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.practical_passed} onChange={(e) => setS({ ...s, practical_passed: e.target.checked })} />{t("fs_practical_passed")}</label>
              <Field label={t("a_notes")}><textarea rows={3} maxLength={2000} value={s.notes ?? ""} onChange={(e) => setS({ ...s, notes: e.target.value })} className={inputCls} /></Field>
              {canManage && <button className={cx(btnPrimary, "w-full")}><Save className="h-4 w-4" />{t("save")}</button>}
            </fieldset>
          </form>
        </Card>
      </div>
    </div>
  );
}

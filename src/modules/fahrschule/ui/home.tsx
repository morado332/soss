import Link from "next/link";
import { and, asc, count, eq, gte, lt, ne, sql } from "drizzle-orm";
import { GraduationCap, CalendarClock, UserCheck, Car } from "lucide-react";
import { db } from "@/db";
import { fs_students, fs_lessons, fs_instructors, fs_vehicles } from "@/db/schema";
import { Badge, Card, Empty, Stat, statusTone } from "@/components/ui";
import { Progress, typeLabel } from "./shared";
import type { DictKey, TFn } from "@/lib/i18n";

/** Driving-school overview shown on the dashboard home instead of shop widgets. */
export async function FahrschuleHome({ tenantId, t, locale }: { tenantId: string; t: TFn; locale: string }) {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86_400_000);
  const [[students], [today], [working], [vehicles], next, closest] = await Promise.all([
    db.select({ n: count() }).from(fs_students).where(and(eq(fs_students.tenant_id, tenantId), eq(fs_students.status, "active"))),
    db.select({ n: count() }).from(fs_lessons).where(and(eq(fs_lessons.tenant_id, tenantId), gte(fs_lessons.starts_at, start), lt(fs_lessons.starts_at, end), ne(fs_lessons.status, "cancelled"))),
    db.select({ n: sql<number>`count(distinct ${fs_lessons.instructor_id})::int` }).from(fs_lessons).where(and(eq(fs_lessons.tenant_id, tenantId), gte(fs_lessons.starts_at, start), lt(fs_lessons.starts_at, end), ne(fs_lessons.status, "cancelled"))),
    db.select({ n: count() }).from(fs_vehicles).where(and(eq(fs_vehicles.tenant_id, tenantId), eq(fs_vehicles.is_active, true))),
    db.select({ id: fs_lessons.id, starts_at: fs_lessons.starts_at, type: fs_lessons.type, status: fs_lessons.status, student: fs_students.name, instructor: fs_instructors.name })
      .from(fs_lessons).innerJoin(fs_students, and(eq(fs_lessons.student_id, fs_students.id), eq(fs_students.tenant_id, tenantId)))
      .innerJoin(fs_instructors, and(eq(fs_lessons.instructor_id, fs_instructors.id), eq(fs_instructors.tenant_id, tenantId)))
      .where(and(eq(fs_lessons.tenant_id, tenantId), gte(fs_lessons.starts_at, new Date()), eq(fs_lessons.status, "scheduled"))).orderBy(asc(fs_lessons.starts_at)).limit(6),
    db.select({
      id: fs_students.id, name: fs_students.name, theory: fs_students.theory_progress,
      req: sql<number>`(${fs_students.req_normal} + ${fs_students.req_ueberland} + ${fs_students.req_autobahn} + ${fs_students.req_nacht})::int`,
      done: sql<number>`coalesce((select sum(l.units) from fs_lessons l where l.student_id = "fs_students"."id" and l.tenant_id = ${tenantId} and l.status = 'completed' and l.type <> 'exam'),0)::int`,
    }).from(fs_students).where(and(eq(fs_students.tenant_id, tenantId), eq(fs_students.status, "active"))).limit(200),
  ]);
  const top = closest.sort((a, b) => b.done / Math.max(1, b.req) - a.done / Math.max(1, a.req)).slice(0, 5);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("fs_home_students")} value={String(students.n)} icon={GraduationCap} />
        <Stat label={t("fs_home_today")} value={String(today.n)} icon={CalendarClock} tone="sky" />
        <Stat label={t("fs_home_instructors")} value={String(working.n)} icon={UserCheck} tone="emerald" />
        <Stat label={t("fs_home_vehicles")} value={String(vehicles.n)} icon={Car} tone="amber" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t("fs_home_next")} padded={false} action={<Link href="/dashboard/m/fahrschule/lessons" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link>}>
          {next.length === 0 ? <div className="p-5"><Empty icon={CalendarClock} text={t("fs_no_lessons")} /></div> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {next.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="tabular w-32 font-medium">{new Date(l.starts_at).toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="min-w-0 flex-1 truncate">{l.student} <span className="text-slate-400">· {t(typeLabel(l.type))} · {l.instructor}</span></span>
                  <Badge tone={statusTone(l.status)}>{t(`st_${l.status}` as DictKey)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t("fs_home_progress")} action={<Link href="/dashboard/m/fahrschule/students" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link>}>
          {top.length === 0 ? <Empty icon={GraduationCap} text={t("fs_none_students")} /> : (
            <ul className="space-y-4">
              {top.map((s) => (
                <li key={s.id}><Link href={`/dashboard/m/fahrschule/students/${s.id}`} className="block space-y-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <p className="text-sm font-medium">{s.name}</p>
                  <div className="grid grid-cols-2 gap-3"><Progress label={t("fs_nav_lessons")} done={s.done} required={s.req} /><Progress label={t("fs_theory")} done={s.theory} required={100} tone="bg-violet-500" /></div>
                </Link></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

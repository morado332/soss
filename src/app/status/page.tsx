import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleX, Database, KeyRound, FolderTree, Table2 } from "lucide-react";
import { checkHealth, type HealthCode } from "@/lib/diagnostics";
import { runMigrations } from "@/startup";
import { getI18n, getTheme } from "@/lib/i18n-server";
import { AuthLayout } from "@/components/auth-layout";
import { Alert, btnPrimary } from "@/components/ui";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Status", robots: { index: false } };

type Tri = [string, string, string];
const pick = (l: Lang, t: Tri) => t[l === "de" ? 0 : l === "en" ? 1 : 2];

const TITLE: Tri = ["Systemstatus", "System status", "حالة النظام"];
const OK: Tri = ["Alles bereit. Die Plattform ist einsatzbereit.", "All good. The platform is ready.", "كل شيء جاهز. المنصة تعمل."];
const FIX: Record<Exclude<HealthCode, "OK">, Tri> = {
  NO_DATABASE_URL: [
    "Keine Datenbank verbunden. Vercel: Projekt → Storage → Create Database → Neon → Connect. Danach Deployments → ⋮ → Redeploy.",
    "No database connected. On Vercel: Project → Storage → Create Database → Neon → Connect. Then Deployments → ⋮ → Redeploy.",
    "لا توجد قاعدة بيانات مربوطة. في Vercel: المشروع ← Storage ← Create Database ← Neon ← Connect. ثم Deployments ← ⋮ ← Redeploy.",
  ],
  DB_UNREACHABLE: [
    "Die Datenbank ist nicht erreichbar oder die Zugangsdaten sind falsch. Prüfen Sie DATABASE_URL (Settings → Environment Variables) und deployen Sie neu.",
    "The database cannot be reached or the credentials are wrong. Check DATABASE_URL (Settings → Environment Variables) and redeploy.",
    "تعذّر الاتصال بقاعدة البيانات أو بيانات الدخول خاطئة. تحقّق من DATABASE_URL في Settings ← Environment Variables ثم أعد النشر (Redeploy).",
  ],
  MIGRATIONS_NOT_FOUND: [
    "Die Migrationsdateien fehlen im Deployment. Bitte neu deployen.",
    "Migration files are missing from the deployment. Please redeploy.",
    "ملفات إنشاء الجداول غير موجودة في النشر. أعد النشر (Redeploy).",
  ],
  MIGRATIONS_PENDING: [
    "Datenbank verbunden, Tabellen werden angelegt … Seite neu laden.",
    "Database connected, creating tables … reload this page.",
    "قاعدة البيانات متصلة، وجارٍ إنشاء الجداول… أعد تحميل الصفحة.",
  ],
};
const LABELS: Record<string, Tri> = {
  env: ["DATABASE_URL gesetzt", "DATABASE_URL set", "متغير DATABASE_URL موجود"],
  db: ["Datenbank erreichbar", "Database reachable", "الاتصال بقاعدة البيانات"],
  migrationsFolder: ["Migrationsdateien vorhanden", "Migration files present", "ملفات الجداول موجودة"],
  tables: ["Tabellen angelegt", "Tables created", "الجداول منشأة"],
};
const ICONS = { env: KeyRound, db: Database, migrationsFolder: FolderTree, tables: Table2 };

export default async function StatusPage() {
  const { lang } = await getI18n();
  const { t } = await getI18n();
  let health = await checkHealth();
  // Self-heal: database reachable but tables missing → run the migrations now.
  if (health.code === "MIGRATIONS_PENDING") {
    try { await runMigrations(); } catch { /* reported below */ }
    health = await checkHealth();
  }
  return (
    <AuthLayout t={t} theme={await getTheme()}>
      <h1 className="text-2xl font-semibold tracking-tight">{pick(lang, TITLE)}</h1>
      <ul className="mt-6 space-y-2">
        {(Object.keys(health.checks) as (keyof typeof health.checks)[]).map((k) => {
          const Icon = ICONS[k];
          const ok = health.checks[k];
          return (
            <li key={k} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <Icon className="h-4 w-4 text-slate-400" />
              <span className="flex-1">{pick(lang, LABELS[k])}</span>
              {ok ? <CircleCheck className="h-5 w-5 text-emerald-500" /> : <CircleX className="h-5 w-5 text-red-500" />}
            </li>
          );
        })}
      </ul>
      <div className="mt-6">
        {health.code === "OK"
          ? <Alert tone="success">{pick(lang, OK)}</Alert>
          : <Alert tone="error"><b>{health.code}</b>{health.detail ? ` (${health.detail})` : ""}<br />{pick(lang, FIX[health.code])}</Alert>}
      </div>
      {health.code === "OK" && <Link href="/login" className={`${btnPrimary} mt-6 w-full`}>{t("login")}</Link>}
    </AuthLayout>
  );
}

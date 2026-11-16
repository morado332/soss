"use client";
import { useCallback, useState } from "react";
import { BookOpen, RefreshCw, Save, Link2 } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, btnPrimary, btnSecondary, cx, inputCls } from "@/components/ui";
import { Progress } from "@/modules/fahrschule/ui/shared";

type S = { id: string; name: string; theory_progress: number; theory_passed: boolean; theory_external_id: string | null; theory_synced_at: string | null };
type Cfg = { url: string; hasKey: boolean; students: S[] };

export default function TheoryClient({ canManage }: { canManage: boolean }) {
  const { t, err, locale } = useI18n();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => { const r = await api<Cfg>("/api/m/fahrschule/theory"); if (r.ok) { setCfg(r.data); setUrl(r.data.url); } }, []);
  useLoader(() => { load(); }, [load]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("/api/m/fahrschule/theory", "PATCH", { url, key: key || undefined });
    setMsg(r.ok ? { tone: "success", text: t("saved") } : { tone: "error", text: err(r.data.error) }); setKey(""); load();
  }
  async function sync() {
    const r = await api<{ updated: number; failed: number }>("/api/m/fahrschule/theory", "POST");
    setMsg(r.ok ? { tone: r.data.failed ? "error" : "success", text: t("fs_theory_synced", { n: r.data.updated, f: r.data.failed }) } : { tone: "error", text: err(r.data.error) }); load();
  }
  return (
    <div className="space-y-6">
      <PageHeader title={t("fs_nav_theory")} description={t("fs_theory_sub")} actions={canManage && cfg?.url ? <button onClick={sync} className={btnPrimary}><RefreshCw className="h-4 w-4" />{t("fs_theory_sync")}</button> : undefined} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card title={t("fs_home_progress")} padded={false}>
          {!cfg || cfg.students.length === 0 ? <div className="p-5"><Empty icon={BookOpen} text={t("fs_none_students")} /></div> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {cfg.students.map((s) => (
                <li key={s.id} className="grid items-center gap-3 px-5 py-3 sm:grid-cols-[200px_1fr_auto]">
                  <div><p className="text-sm font-medium">{s.name}</p><p className="text-xs text-slate-500">{s.theory_external_id ? `ID ${s.theory_external_id}` : "—"}{s.theory_synced_at ? ` · ${t("fs_theory_last")} ${new Date(s.theory_synced_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}` : ""}</p></div>
                  <Progress label={t("fs_theory")} done={s.theory_progress} required={100} tone="bg-violet-500" />
                  {s.theory_passed ? <Badge tone="green">✓ {t("fs_theory_passed")}</Badge> : <span />}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={<span className="flex items-center gap-2"><Link2 className="h-4 w-4" />{t("fs_theory_conn")}</span>}>
          {!cfg?.url && <Alert tone="info">{t("fs_theory_off")}</Alert>}
          <form onSubmit={save} className="mt-3">
            <fieldset disabled={!canManage} className="space-y-3">
              <Field label={t("fs_theory_url")}><input type="url" maxLength={300} placeholder="https://theorie.example.de/api" value={url} onChange={(e) => setUrl(e.target.value)} className={cx(inputCls, "font-mono")} dir="ltr" /></Field>
              <Field label={t("fs_theory_key")}><input type="password" autoComplete="off" maxLength={500} placeholder={cfg?.hasKey ? t("fs_theory_key_saved") : ""} value={key} onChange={(e) => setKey(e.target.value)} className={inputCls} dir="ltr" /></Field>
              <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300" dir="ltr">{t("fs_theory_format")}</p>
              {canManage && <button className={cx(btnSecondary, "w-full")}><Save className="h-4 w-4" />{t("save")}</button>}
            </fieldset>
          </form>
        </Card>
      </div>
    </div>
  );
}

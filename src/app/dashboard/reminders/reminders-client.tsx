"use client";
import { useCallback, useState } from "react";
import { BellRing, Send, CalendarClock, CalendarDays } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, PageHeader, btnPrimary } from "@/components/ui";

type Item = { id: string; kind: "appointment" | "lesson"; name: string; email: string | null; starts_at: string; r24: string | null; r1: string | null };

export default function RemindersClient({ canRun }: { canRun: boolean }) {
  const { t, err, locale } = useI18n();
  const [data, setData] = useState<{ email: boolean; items: Item[] } | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => { const r = await api<{ email: boolean; items: Item[] }>("/api/reminders"); if (r.ok) setData(r.data); }, []);
  useLoader(() => { load(); }, [load]);

  async function run() {
    const r = await api<{ processed: number }>("/api/reminders", "POST");
    setMsg(r.ok ? { tone: "success", text: t("rem_ran", { n: r.data.processed }) } : { tone: "error", text: err(r.data.error) });
    load();
  }
  const state = (sent: string | null) => sent ? <Badge tone="green">✓ {t("rem_sent")}</Badge> : <Badge tone="slate">{t("rem_pending")}</Badge>;

  return (
    <div className="space-y-6">
      <PageHeader title={t("rem_title")} description={t("rem_sub")} actions={canRun ? <button onClick={run} className={btnPrimary}><Send className="h-4 w-4" />{t("rem_run")}</button> : undefined} />
      {data && <Alert tone={data.email ? "success" : "warning"} icon={BellRing}>{data.email ? t("rem_email_on") : t("rem_email_off")} {t("rem_auto")}</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card title={t("rem_upcoming")} padded={false}>
        {!data || data.items.length === 0 ? <div className="p-5"><Empty icon={BellRing} text={t("rem_none")} /></div> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.items.map((i) => (
              <li key={i.kind + i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                {i.kind === "lesson" ? <CalendarClock className="h-4 w-4 text-indigo-500" /> : <CalendarDays className="h-4 w-4 text-sky-500" />}
                <span className="tabular w-44 text-sm font-medium">{new Date(i.starts_at).toLocaleString(locale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{i.name}<span className="text-slate-400"> · {i.email ?? "—"}</span></span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">{t("rem_24")} {state(i.r24)}</span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">{t("rem_1")} {state(i.r1)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

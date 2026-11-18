"use client";
import { useCallback, useState } from "react";
import { LogIn, LogOut, Clock } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, PageHeader, Table, btnDanger, btnPrimary, cx, tdCls, thCls } from "@/components/ui";

type Row = { id: string; data: { user_id: string; name: string; in: string; out?: string; minutes?: number } };
const hm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;

export default function AttendanceClient() {
  const { t, err, locale } = useI18n();
  const [d, setD] = useState<{ rows: Row[]; all: boolean; open: string | null } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await api<{ rows: Row[]; all: boolean; open: string | null }>("/api/m/attendance"); if (r.ok) setD(r.data); }, []);
  useLoader(() => { load(); }, [load]);
  async function clock(action: "in" | "out") { const r = await api("/api/m/attendance", "POST", { action }); setMsg(r.ok ? null : err(r.data.error)); load(); }
  if (!d) return <p className="p-6 text-sm text-slate-500">{t("loading")}</p>;
  const totals = new Map<string, { name: string; m: number; days: Set<string> }>();
  for (const r of d.rows) { const x = totals.get(r.data.user_id) ?? { name: r.data.name, m: 0, days: new Set() }; x.m += r.data.minutes ?? 0; x.days.add(r.data.in.slice(0, 10)); totals.set(r.data.user_id, x); }
  const time = (s: string) => new Date(s).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_attendance")} description={t("at_sub")} actions={d.open
        ? <button onClick={() => clock("out")} className={btnDanger}><LogOut className="h-4 w-4" />{t("at_out")}</button>
        : <button onClick={() => clock("in")} className={btnPrimary}><LogIn className="h-4 w-4" />{t("at_in")}</button>} />
      {msg && <Alert tone="error">{msg}</Alert>}
      {d.open && <Alert tone="success">{t("at_running")}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[...totals.values()].map((x) => <Card key={x.name}><p className="text-sm font-medium">{x.name}</p><p className="tabular mt-1 text-xl font-semibold">{hm(x.m)}</p><p className="text-xs text-slate-500">{t("at_days", { n: x.days.size })} · 31 {t("at_period")}</p></Card>)}
      </div>
      <Card padded={false}>
        {d.rows.length === 0 ? <div className="p-5"><Empty icon={Clock} text={t("biz_empty")} /></div> : (
          <Table head={<>{d.all && <th className={thCls}>{t("name")}</th>}<th className={thCls}>{t("f_date")}</th><th className={thCls}>{t("at_inT")}</th><th className={thCls}>{t("at_outT")}</th><th className={thCls}>{t("at_hours")}</th></>}>
            {d.rows.map((r) => (
              <tr key={r.id}>
                {d.all && <td className={cx(tdCls, "font-medium")}>{r.data.name}</td>}
                <td className={tdCls}>{new Date(r.data.in).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" })}</td>
                <td className={cx(tdCls, "tabular")}>{time(r.data.in)}</td>
                <td className={cx(tdCls, "tabular")}>{r.data.out ? time(r.data.out) : <Badge tone="green">{t("at_now")}</Badge>}</td>
                <td className={cx(tdCls, "tabular font-semibold")}>{r.data.minutes != null ? hm(r.data.minutes) : "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

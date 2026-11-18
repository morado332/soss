"use client";
import { useCallback, useState } from "react";
import { Send, MessagesSquare, Users } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Card, Empty, PageHeader, btnPrimary, cx, inputCls } from "@/components/ui";

type Msg = { id: string; created_at: string; data: { from: string; from_name: string; to: string | null; body: string; read_by: string[] } };

export default function MessagesClient() {
  const { t, err, locale } = useI18n();
  const [d, setD] = useState<{ me: string; rows: Msg[]; staff: { id: string; name: string }[] } | null>(null);
  const [chan, setChan] = useState<string>("all");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await api<{ me: string; rows: Msg[]; staff: { id: string; name: string }[] }>("/api/m/messages"); if (r.ok) setD(r.data); }, []);
  useLoader(() => { load(); api("/api/m/messages", "PATCH", {}); const h = setInterval(load, 15000); return () => clearInterval(h); }, [load]);
  if (!d) return <p className="p-6 text-sm text-slate-500">{t("loading")}</p>;
  const inChan = (m: Msg) => chan === "all" ? m.data.to === null : (m.data.to === chan && m.data.from === d.me) || (m.data.from === chan && m.data.to === d.me);
  const unread = (id: string) => d.rows.filter((m) => !m.data.read_by?.includes(d.me) && (id === "all" ? m.data.to === null : m.data.from === id && m.data.to === d.me)).length;
  const list = d.rows.filter(inChan).reverse();
  async function send(e: React.FormEvent) {
    e.preventDefault(); if (!body.trim()) return;
    const r = await api("/api/m/messages", "POST", { to: chan === "all" ? null : chan, body });
    if (!r.ok) return setError(err(r.data.error)); setBody(""); setError(null); load();
  }
  const chans = [{ id: "all", name: t("msg_all") }, ...d.staff];
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_messages")} description={t("msg_sub")} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card padded={false}><ul className="p-2">{chans.map((c) => (
          <li key={c.id}><button onClick={() => setChan(c.id)} className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm", chan === c.id ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300" : "hover:bg-slate-50 dark:hover:bg-slate-800")}>
            {c.id === "all" ? <Users className="h-4 w-4" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-[10px] font-bold dark:bg-slate-700">{c.name.slice(0, 2).toUpperCase()}</span>}
            <span className="flex-1 truncate">{c.name}</span>{unread(c.id) > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unread(c.id)}</span>}
          </button></li>))}</ul></Card>
        <Card padded={false} className="flex min-h-[480px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {list.length === 0 ? <Empty icon={MessagesSquare} text={t("msg_none")} /> : list.map((m) => { const mine = m.data.from === d.me; return (
              <div key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[75%] rounded-2xl px-4 py-2 text-sm", mine ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800")}>
                  {!mine && <p className="text-xs font-semibold opacity-70">{m.data.from_name}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.data.body}</p>
                  <p className="mt-1 text-[10px] opacity-60">{new Date(m.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
              </div>); })}
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-slate-100 p-3 dark:border-slate-800">
            <input value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder={t("msg_placeholder")} className={inputCls} />
            <button className={btnPrimary}><Send className="h-4 w-4 rtl:rotate-180" /></button>
          </form>
        </Card>
      </div>
    </div>
  );
}

"use client";
import { useCallback, useState } from "react";
import { Megaphone, Check, Plus } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, PageHeader, btnPrimary, btnSecondary, cx, inputCls } from "@/components/ui";

type TicketT = { id: string; number: number; status: string; patient_name: string | null };

export default function QueueClient({ canWrite }: { canWrite: boolean }) {
  const { t, err } = useI18n();
  const [tickets, setTickets] = useState<TicketT[]>([]);
  const [patient, setPatient] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const r = await api<TicketT[]>("/api/queue"); if (r.ok) setTickets(r.data as unknown as TicketT[]); }, []);
  useLoader(() => { load(); const id = setInterval(load, 10_000); return () => clearInterval(id); }, [load]);

  async function act(action: "new" | "next" | "done") {
    const r = await api("/api/queue", "POST", { action, patient_name: action === "new" ? patient || undefined : undefined });
    setMsg(r.ok ? "" : err(r.data.error)); setPatient(""); load();
  }
  const called = tickets.find((x) => x.status === "called");
  const waiting = tickets.filter((x) => x.status === "waiting");

  return (
    <div className="space-y-6">
      <PageHeader title={t("q_title")} description={t("q_waiting", { n: waiting.length })} />
      {msg && <Alert tone="error">{msg}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("q_now")}>
          <p className="tabular py-6 text-center text-7xl font-bold text-indigo-600 dark:text-indigo-400">{called ? `#${called.number}` : "—"}</p>
          {called?.patient_name && <p className="text-center text-lg">{called.patient_name}</p>}
          {canWrite && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => act("next")} className={cx(btnPrimary, "h-14 text-base")}><Megaphone className="h-5 w-5" />{t("q_next")}</button>
              <button onClick={() => act("done")} className={cx(btnSecondary, "h-14 text-base")}><Check className="h-5 w-5" />{t("q_done")}</button>
            </div>
          )}
        </Card>
        <Card title={t("q_waiting", { n: waiting.length })}>
          <div className="flex min-h-24 flex-wrap gap-2">
            {waiting.length === 0 ? <p className="text-sm text-slate-500">{t("q_empty")}</p> : waiting.map((x) => <Badge key={x.id} tone="amber">#{x.number} {x.patient_name ?? ""}</Badge>)}
          </div>
          {canWrite && (
            <div className="mt-6 flex gap-2">
              <input value={patient} onChange={(e) => setPatient(e.target.value)} maxLength={120} placeholder={t("q_patient")} className={inputCls} />
              <button onClick={() => act("new")} className={btnSecondary}><Plus className="h-4 w-4" />{t("q_new")}</button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

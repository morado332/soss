"use client";
import { useCallback, useState } from "react";
import { Car, Plus } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnPrimary, btnSecondary, btnSm, cx, inputCls, tdCls, thCls } from "@/components/ui";

type V = { id: string; name: string; plate: string; license_class: string; transmission: string; next_service: string | null; is_active: boolean };
const empty = { name: "", plate: "", license_class: "B", transmission: "manual", next_service: "" };

export default function VehiclesClient({ canManage }: { canManage: boolean }) {
  const { t, err, locale } = useI18n();
  const [rows, setRows] = useState<V[]>([]);
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const r = await api<V[]>("/api/m/fahrschule/vehicles"); if (r.ok) setRows(r.data as unknown as V[]); }, []);
  useLoader(() => { load(); }, [load]);
  async function create(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await api("/api/m/fahrschule/vehicles", "POST", f);
    if (!r.ok) return setMsg(err(r.data.error));
    setF(empty); load();
  }
  async function toggle(v: V) { await api("/api/m/fahrschule/vehicles", "PATCH", { id: v.id, is_active: !v.is_active }); load(); }
  const soon = (d: string | null) => !!d && new Date(d).getTime() - nowMs() < 14 * 86_400_000;
  return (
    <div className="space-y-6">
      <PageHeader title={t("fs_nav_vehicles")} description={t("fs_vehicles_sub")} />
      {msg && <Alert tone="error">{msg}</Alert>}
      {canManage && (
        <Card title={t("fs_new_vehicle")}>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label={`${t("fs_model")} *`}><input required minLength={2} maxLength={120} placeholder="VW Golf 8" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
            <Field label={`${t("fs_plate")} *`}><input required minLength={2} maxLength={20} placeholder="B-FS 123" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} className={inputCls} /></Field>
            <Field label={t("fs_license_class")}><input maxLength={10} value={f.license_class} onChange={(e) => setF({ ...f, license_class: e.target.value })} className={inputCls} /></Field>
            <Field label={t("fs_transmission")}>
              <select value={f.transmission} onChange={(e) => setF({ ...f, transmission: e.target.value })} className={inputCls}><option value="manual">{t("fs_manual")}</option><option value="automatic">{t("fs_automatic")}</option></select>
            </Field>
            <Field label={t("fs_next_service")}><input type="date" value={f.next_service} onChange={(e) => setF({ ...f, next_service: e.target.value })} className={inputCls} /></Field>
            <div className="lg:col-span-5"><button className={btnPrimary}><Plus className="h-4 w-4" />{t("create")}</button></div>
          </form>
        </Card>
      )}
      <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty icon={Car} text={t("fs_none_vehicles")} /></div> : (
          <Table head={<><th className={thCls}>{t("fs_model")}</th><th className={thCls}>{t("fs_plate")}</th><th className={thCls}>{t("fs_transmission")}</th><th className={thCls}>{t("fs_next_service")}</th><th className={thCls}></th></>}>
            {rows.map((v) => (
              <tr key={v.id} className={v.is_active ? "" : "opacity-50"}>
                <td className={tdCls}><p className="font-medium">{v.name}</p><p className="text-xs text-slate-500">{t("fs_license_class")} {v.license_class}</p></td>
                <td className={cx(tdCls, "font-mono")}>{v.plate}</td>
                <td className={tdCls}>{v.transmission === "automatic" ? t("fs_automatic") : t("fs_manual")}</td>
                <td className={tdCls}>{v.next_service ? <span className="flex items-center gap-2">{new Date(v.next_service).toLocaleDateString(locale)}{soon(v.next_service) && <Badge tone="amber">{t("fs_service_due")}</Badge>}</span> : "—"}</td>
                <td className={cx(tdCls, "text-end")}>{canManage && <button onClick={() => toggle(v)} className={cx(btnSecondary, btnSm)}>{v.is_active ? t("p_deactivate") : t("p_activate")}</button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

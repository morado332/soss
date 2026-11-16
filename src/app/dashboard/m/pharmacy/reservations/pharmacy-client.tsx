"use client";
import { useCallback, useState } from "react";
import { Pill, Save, Search, PackageCheck, XCircle, CheckCheck } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Badge, Card, Empty, Field, PageHeader, Table, btnDanger, btnPrimary, btnSecondary, btnSm, cx, inputCls, tdCls, thCls, type Tone } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Res = { id: string; customer_name: string | null; customer_phone: string | null; customer_email: string | null; items: { name: string; qty: number; rx: boolean }[]; total_cents: number; status: string; requires_prescription: boolean; reservation_fee_cents: number; payment_status: string; pickup_code: string | null; created_at: string };
type Med = { id: string; name: string; category: string | null; price_cents: number; stock: number; rx_required: boolean; reservable: boolean };
const ST_TONE: Record<string, Tone> = { reserved: "blue", ready: "green", picked_up: "slate", cancelled: "red" };
const PAY_TONE: Record<string, Tone> = { paid: "green", pending: "amber", failed: "red", at_pickup: "violet", none: "slate" };

export default function PharmacyClient({ owner }: { owner: boolean }) {
  const { t, err, locale } = useI18n();
  const [tab, setTab] = useState<"res" | "meds" | "settings">("res");
  const [rows, setRows] = useState<Res[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);
  const [q, setQ] = useState("");
  const [cfg, setCfg] = useState({ fee: "0", hold: 48, stripe: false });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([api<Res[]>("/api/m/pharmacy/reservations"), api<Med[]>("/api/m/pharmacy/products"), api<{ fee_cents: number; hold_hours: number; stripe_connected: boolean }>("/api/m/pharmacy/settings")]);
    if (a.ok) setRows(a.data as unknown as Res[]);
    if (b.ok) setMeds(b.data as unknown as Med[]);
    if (c.ok) setCfg({ fee: (c.data.fee_cents / 100).toFixed(2), hold: c.data.hold_hours, stripe: c.data.stripe_connected });
  }, []);
  useLoader(() => { load(); }, [load]);
  const say = (ok: boolean, e?: unknown) => setMsg(ok ? { tone: "success", text: t("p2_saved") } : { tone: "error", text: err(e) });
  async function setStatus(id: string, status: string) { const r = await api("/api/m/pharmacy/reservations", "PATCH", { id, status }); say(r.ok, r.ok ? undefined : r.data.error); load(); }
  async function flag(id: string, body: Record<string, boolean>) {
    setMeds((m) => m.map((x) => x.id === id ? { ...x, ...body } : x));
    const r = await api("/api/m/pharmacy/products", "PATCH", { id, ...body }); if (!r.ok) { say(false, r.data.error); load(); }
  }
  async function saveCfg(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("/api/m/pharmacy/settings", "PATCH", { fee_cents: Math.round(Number(cfg.fee) * 100), hold_hours: cfg.hold }); say(r.ok, r.ok ? undefined : r.data.error);
  }
  const open = rows.filter((r) => r.status === "reserved" || r.status === "ready").length;
  const tabs = ([["res", "ph_tabRes"], ["meds", "ph_tabMeds"], ["settings", "ph_tabSettings"]] as const).filter(([k]) => owner || k !== "settings");
  return (
    <div className="space-y-6">
      <PageHeader title={t("ph_nav")} description={t("ph_sub", { n: open })} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm dark:bg-slate-800/60">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cx("flex-1 rounded-lg px-3 py-1.5 font-medium", tab === k ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500")}>{t(l)}</button>)}
      </div>

      {tab === "res" && <Card padded={false}>
        {rows.length === 0 ? <div className="p-5"><Empty icon={Pill} text={t("ph_noRes")} /></div> : (
          <Table head={<><th className={thCls}>{t("ph_pickupCode")}</th><th className={thCls}>{t("ph_customer")}</th><th className={thCls}>{t("ph_items")}</th><th className={thCls}>{t("status")}</th><th className={thCls}>{t("ph_fee")}</th><th className={thCls}></th></>}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={tdCls}><code className="font-mono font-bold tracking-widest">{r.pickup_code}</code><p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</p></td>
                <td className={tdCls}><p className="font-medium">{r.customer_name}</p><p className="text-xs text-slate-500"><span dir="ltr">{r.customer_phone}</span>{r.customer_email ? ` · ${r.customer_email}` : ""}</p></td>
                <td className={tdCls}><ul className="text-xs">{(r.items ?? []).map((i, k) => <li key={k}>{i.qty}× {i.name}{i.rx && <Badge tone="amber">Rx</Badge>}</li>)}</ul><p className="text-xs text-slate-500">{money(r.total_cents)}</p></td>
                <td className={tdCls}><Badge tone={ST_TONE[r.status] ?? "slate"}>{t(`ph_st_${r.status}` as DictKey)}</Badge></td>
                <td className={tdCls}>{r.reservation_fee_cents > 0 ? <><span className="tabular">{money(r.reservation_fee_cents)}</span> <Badge tone={PAY_TONE[r.payment_status] ?? "slate"}>{t(`ph_pay_${r.payment_status}` as DictKey)}</Badge></> : <span className="text-xs text-slate-500">{t("ph_free")}</span>}</td>
                <td className={cx(tdCls, "text-end")}><div className="flex justify-end gap-1">
                  {r.status === "reserved" && <button onClick={() => setStatus(r.id, "ready")} className={cx(btnSecondary, btnSm)}><PackageCheck className="h-3.5 w-3.5" />{t("ph_markReady")}</button>}
                  {(r.status === "reserved" || r.status === "ready") && <>
                    <button onClick={() => setStatus(r.id, "picked_up")} className={cx(btnPrimary, btnSm)}><CheckCheck className="h-3.5 w-3.5" />{t("ph_markPicked")}</button>
                    <button onClick={() => confirm(t("ph_confirmCancel")) && setStatus(r.id, "cancelled")} className={cx(btnDanger, btnSm)}><XCircle className="h-3.5 w-3.5" /></button>
                  </>}
                </div></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>}

      {tab === "meds" && <Card padded={false} title={t("ph_medsSub")} action={<div className="relative w-56"><Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={cx(inputCls, "ps-8")} /></div>}>
        {meds.length === 0 ? <div className="p-5"><Empty icon={Pill} text={t("ph_noMeds")} /></div> : (
          <Table head={<><th className={thCls}>{t("name")}</th><th className={thCls}>{t("ph_stock")}</th><th className={thCls}>{t("ph_reservable")}</th><th className={thCls}>{t("ph_rx")}</th></>}>
            {meds.filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
              <tr key={m.id}>
                <td className={tdCls}><p className="font-medium">{m.name}</p><p className="text-xs text-slate-500">{m.category} · {money(m.price_cents)}</p></td>
                <td className={cx(tdCls, "tabular")}>{m.stock}</td>
                <td className={tdCls}><input type="checkbox" checked={m.reservable} onChange={(e) => flag(m.id, { reservable: e.target.checked })} aria-label={t("ph_reservable")} /></td>
                <td className={tdCls}><input type="checkbox" checked={m.rx_required} onChange={(e) => flag(m.id, { rx_required: e.target.checked })} aria-label={t("ph_rx")} /></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>}

      {tab === "settings" && owner && <Card title={t("ph_tabSettings")}>
        <form onSubmit={saveCfg} className="grid gap-4 sm:grid-cols-3">
          <Field label={t("ph_feeLabel")} hint={t("ph_feeHint")}><input type="number" min={0} max={50} step="0.01" value={cfg.fee} onChange={(e) => setCfg({ ...cfg, fee: e.target.value })} className={inputCls} /></Field>
          <Field label={t("ph_holdLabel")}><input type="number" min={1} max={336} value={cfg.hold} onChange={(e) => setCfg({ ...cfg, hold: Number(e.target.value) })} className={inputCls} /></Field>
          <div className="flex items-end"><button className={btnPrimary}><Save className="h-4 w-4" />{t("save")}</button></div>
          <p className="text-xs text-slate-500 sm:col-span-3">{cfg.stripe ? t("ph_stripeOn") : t("ph_stripeOff")}</p>
        </form>
      </Card>}
    </div>
  );
}

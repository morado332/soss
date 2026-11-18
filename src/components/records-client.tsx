"use client";
import { useCallback, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Save, Download, Inbox } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { KINDS, type Field, type KindDef, type KindKey } from "@/modules/business/kinds";
import { Alert, Badge, Card, Empty, Field as FormField, PageHeader, Table, btnDanger, btnPrimary, btnSecondary, btnSm, cx, inputCls, tdCls, thCls, type Tone } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

type Row = { id: string; data: Record<string, unknown>; created_at: string };
type Opt = { id: string; title: string };
const TONES: Record<string, Tone> = {
  done: "green", paid: "green", approved: "green", completed: "green", free: "green", available: "green", active: "green", closed: "green", income: "green", receipt: "green", true: "green",
  doing: "blue", in_progress: "blue", submitted: "blue", occupied: "amber", reserved: "amber", viewing: "blue", offer: "violet", contacted: "blue", planned: "blue",
  high: "red", lost: "red", cancelled: "red", sold: "slate", on_hold: "amber", expense: "red", payment: "red", requested: "amber", false: "slate",
};
const toForm = (f: Field, v: unknown): string | boolean => {
  if (f.type === "bool") return v === undefined ? Boolean(f.default) : Boolean(v);
  if (v === undefined || v === null) return f.default !== undefined && f.type !== "money" ? String(f.default) : f.type === "money" && f.default !== undefined ? (Number(f.default) / 100).toFixed(2) : "";
  if (f.type === "money") return (Number(v) / 100).toFixed(2);
  if (f.type === "datetime") { const d = new Date(String(v)); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
  return String(v);
};
const fromForm = (f: Field, v: string | boolean): unknown => {
  if (f.type === "bool") return Boolean(v);
  const s = String(v).trim();
  if (s === "") return "";
  if (f.type === "int") return Math.round(Number(s));
  if (f.type === "decimal" || f.type === "percent") return Number(s.replace(",", "."));
  if (f.type === "money") return Math.round(Number(s.replace(",", ".")) * 100);
  if (f.type === "datetime") return new Date(s).toISOString();
  return s;
};

export function useFieldText() {
  const { t, locale } = useI18n();
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  return (f: Field, v: unknown, refs?: Record<string, Record<string, string>>): string => {
    if (v === undefined || v === null || v === "") return "—";
    switch (f.type) {
      case "money": return money(Number(v));
      case "percent": return `${Number(v).toLocaleString(locale)} %`;
      case "decimal": case "int": return Number(v).toLocaleString(locale);
      case "date": return new Date(`${v}T00:00:00`).toLocaleDateString(locale);
      case "datetime": return new Date(String(v)).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
      case "select": return t(`o_${v}` as DictKey);
      case "bool": return t(v ? "o_yes" : "o_no");
      case "ref": case "product": case "staff": return refs?.[f.key]?.[String(v)] ?? "—";
      default: return String(v);
    }
  };
}

/** Form for one record of a kind (used by the generic page and by special pages, e.g. expiry). */
export function RecordForm({ def, initial, onSaved, onCancel, id }: { def: KindDef; initial?: Record<string, unknown>; id?: string; onSaved: () => void; onCancel: () => void }) {
  const { t, err } = useI18n();
  const [v, setV] = useState<Record<string, string | boolean>>(() => Object.fromEntries(def.fields.map((f) => [f.key, toForm(f, initial?.[f.key])])));
  const [opts, setOpts] = useState<Record<string, Opt[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useLoader(() => { (async () => {
    const o: Record<string, Opt[]> = {};
    for (const f of def.fields) {
      const url = f.type === "ref" ? `/api/m/biz/${f.ref}?lite=1` : f.type === "product" ? "/api/m/lookup?type=product" : f.type === "staff" ? "/api/m/lookup?type=staff" : null;
      if (!url) continue;
      const r = await api<Opt[]>(url); o[f.key] = r.ok ? (r.data as unknown as Opt[]) : [];
    }
    setOpts(o);
  })(); }, [def.key]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const data = Object.fromEntries(def.fields.map((f) => [f.key, fromForm(f, v[f.key])]).filter(([, x]) => x !== "" || id));
    const r = id ? await api(`/api/m/biz/${def.key}`, "PATCH", { id, data }) : await api(`/api/m/biz/${def.key}`, "POST", data);
    setBusy(false);
    if (!r.ok) { const fld = (r.data as { field?: string }).field; return setError(`${err(r.data.error)}${fld ? ` (${t(`f_${fld}` as DictKey)})` : ""}`); }
    onSaved();
  }
  const input = (f: Field) => {
    const val = v[f.key]; const set = (x: string | boolean) => setV((p) => ({ ...p, [f.key]: x }));
    const common = { required: f.required, className: inputCls };
    switch (f.type) {
      case "textarea": return <textarea rows={3} maxLength={4000} value={String(val)} onChange={(e) => set(e.target.value)} {...common} />;
      case "select": return <select value={String(val)} onChange={(e) => set(e.target.value)} {...common}>{!f.required && f.default === undefined && <option value="">—</option>}{f.options!.map((o) => <option key={o} value={o}>{t(`o_${o}` as DictKey)}</option>)}</select>;
      case "bool": return <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(val)} onChange={(e) => set(e.target.checked)} />{t("o_yes")}</label>;
      case "ref": case "product": case "staff": return <select value={String(val)} onChange={(e) => set(e.target.value)} {...common}><option value="">—</option>{(opts[f.key] ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</select>;
      case "int": return <input type="number" step="1" value={String(val)} onChange={(e) => set(e.target.value)} {...common} />;
      case "decimal": case "percent": return <input type="number" step="any" min={f.type === "percent" ? 0 : undefined} max={f.type === "percent" ? 100 : undefined} value={String(val)} onChange={(e) => set(e.target.value)} {...common} />;
      case "money": return <div className="relative"><input type="number" step="0.01" value={String(val)} onChange={(e) => set(e.target.value)} {...common} className={cx(inputCls, "pe-8")} /><span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span></div>;
      case "date": return <input type="date" value={String(val)} onChange={(e) => set(e.target.value)} {...common} />;
      case "datetime": return <input type="datetime-local" value={String(val)} onChange={(e) => set(e.target.value)} {...common} />;
      case "email": return <input type="email" maxLength={254} value={String(val)} onChange={(e) => set(e.target.value)} {...common} />;
      case "phone": return <input type="tel" dir="ltr" maxLength={40} pattern="[0-9+()\/\-\s]*" value={String(val)} onChange={(e) => set(e.target.value)} {...common} />;
      default: return <input maxLength={200} value={String(val)} onChange={(e) => set(e.target.value)} {...common} />;
    }
  };
  return (
    <Card title={t(id ? "edit" : `k_${def.key}_new` as DictKey)} action={<button type="button" onClick={onCancel} className={cx(btnSecondary, btnSm)}><X className="h-3.5 w-3.5" /></button>}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {def.fields.map((f) => (
          <FormField key={f.key} label={`${t(`f_${f.key}` as DictKey)}${f.required ? " *" : ""}`} className={f.wide || f.type === "textarea" ? "sm:col-span-2" : undefined}>{input(f)}</FormField>
        ))}
        {error && <div className="sm:col-span-2 lg:col-span-4"><Alert tone="error">{error}</Alert></div>}
        <div className="sm:col-span-2 lg:col-span-4"><button disabled={busy} className={btnPrimary}><Save className="h-4 w-4" />{t("save")}</button></div>
      </form>
    </Card>
  );
}

export default function RecordsClient({ kind, canWrite }: { kind: KindKey; canWrite: boolean }) {
  const def = KINDS[kind] as unknown as KindDef;
  const { t, err, locale } = useI18n();
  const text = useFieldText();
  const [rows, setRows] = useState<Row[]>([]);
  const [refs, setRefs] = useState<Record<string, Record<string, string>>>({});
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [form, setForm] = useState<{ id?: string; data?: Record<string, unknown> } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await api<{ rows: Row[]; refs: Record<string, Record<string, string>> }>(`/api/m/biz/${kind}`);
    if (r.ok) { setRows(r.data.rows); setRefs(r.data.refs); } setLoaded(true);
  }, [kind]);
  useLoader(() => { load(); }, [load]);
  const listFields = def.fields.filter((f) => f.list && f.key !== def.status);
  const statusField = def.status ? def.fields.find((f) => f.key === def.status) : undefined;
  const sumField = def.sum ? def.fields.find((f) => f.key === def.sum) : undefined;
  const shown = useMemo(() => rows.filter((r) => {
    if (status && String(r.data[def.status!]) !== status) return false;
    if (!q) return true;
    const hay = def.fields.map((f) => text(f, r.data[f.key], refs)).join(" ") + (r.data.no ? ` ${def.autoNo}-${r.data.no}` : "");
    return hay.toLowerCase().includes(q.toLowerCase());
  }), [rows, status, q, def, refs, text]);
  const total = sumField ? shown.reduce((s, r) => s + (Number(r.data[sumField.key]) || 0) * (r.data.type === "expense" || r.data.type === "payment" ? -1 : 1), 0) : 0;

  async function remove(r: Row) {
    if (!confirm(t("biz_confirmDelete"))) return;
    const res = await api(`/api/m/biz/${kind}?id=${r.id}`, "DELETE"); if (!res.ok) setMsg(err(res.data.error)); load();
  }
  async function setRowStatus(r: Row, value: string) {
    setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, data: { ...x.data, [def.status!]: statusField?.type === "bool" ? value === "true" : value } } : x));
    const res = await api(`/api/m/biz/${kind}`, "PATCH", { id: r.id, data: { [def.status!]: statusField?.type === "bool" ? value === "true" : value } });
    if (!res.ok) { setMsg(err(res.data.error)); load(); }
  }
  function exportCsv() {
    const cols = def.fields;
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [[...(def.autoNo ? ["No"] : []), ...cols.map((f) => t(`f_${f.key}` as DictKey))].map(esc).join(";"),
      ...shown.map((r) => [...(def.autoNo ? [`${def.autoNo}-${r.data.no ?? ""}`] : []), ...cols.map((f) => text(f, r.data[f.key], refs))].map((x) => esc(x === "—" ? "" : x)).join(";"))];
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" })); a.download = `${kind}.csv`; a.click();
  }
  const statusOpts = statusField ? (statusField.type === "bool" ? ["true", "false"] : statusField.options ?? []) : [];
  return (
    <div className="space-y-6">
      <PageHeader title={t(`k_${kind}` as DictKey)} description={t(`k_${kind}_sub` as DictKey)} actions={<>
        <button onClick={exportCsv} className={btnSecondary} title="CSV"><Download className="h-4 w-4" />CSV</button>
        {canWrite && <button onClick={() => setForm(form ? null : {})} className={btnPrimary}>{form ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{form ? t("cancel") : t(`k_${kind}_new` as DictKey)}</button>}
      </>} />
      {msg && <Alert tone="error">{msg}</Alert>}
      {form && <RecordForm key={form.id ?? "new"} def={def} id={form.id} initial={form.data} onCancel={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
      <Card padded={false} title={<span className="flex items-center gap-3">{shown.length} {t("biz_entries")}{sumField && <span className="tabular rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold dark:bg-slate-800">{t(`f_${sumField.key}` as DictKey)}: {(total / 100).toLocaleString(locale, { style: "currency", currency: "EUR" })}</span>}</span>}
        action={<div className="flex flex-wrap items-center gap-2">
          {statusOpts.length > 0 && <select value={status} onChange={(e) => setStatus(e.target.value)} className={cx(inputCls, "w-40")}><option value="">{t("biz_all")}</option>{statusOpts.map((o) => <option key={o} value={o}>{t(`o_${o}` as DictKey)}</option>)}</select>}
          <div className="relative w-56"><Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={cx(inputCls, "ps-8")} /></div>
        </div>}>
        {!loaded ? <p className="p-5 text-sm text-slate-500">{t("loading")}</p> : shown.length === 0 ? <div className="p-5"><Empty icon={Inbox} text={t("biz_empty")} /></div> : (
          <Table head={<>{def.autoNo && <th className={thCls}>#</th>}{listFields.map((f) => <th key={f.key} className={thCls}>{t(`f_${f.key}` as DictKey)}</th>)}{statusField && <th className={thCls}>{t(`f_${statusField.key}` as DictKey)}</th>}<th className={thCls}></th></>}>
            {shown.map((r) => (
              <tr key={r.id}>
                {def.autoNo && <td className={cx(tdCls, "tabular font-mono text-xs")}>{def.autoNo}-{String(r.data.no ?? "").padStart(4, "0")}</td>}
                {listFields.map((f, i) => <td key={f.key} className={cx(tdCls, i === 0 && "font-medium", (f.type === "money" || f.type === "int" || f.type === "decimal") && "tabular")} dir={f.type === "phone" ? "ltr" : undefined}>{text(f, r.data[f.key], refs)}</td>)}
                {statusField && <td className={tdCls}>{canWrite ? (
                  <select value={String(r.data[statusField.key] ?? "")} onChange={(e) => setRowStatus(r, e.target.value)} className="rounded-md border border-slate-200 bg-transparent px-2 py-1 text-xs dark:border-slate-700">
                    {statusOpts.map((o) => <option key={o} value={o}>{t(`o_${o}` as DictKey)}</option>)}
                  </select>) : <Badge tone={TONES[String(r.data[statusField.key])] ?? "slate"}>{text(statusField, r.data[statusField.key])}</Badge>}</td>}
                <td className={cx(tdCls, "text-end")}>{canWrite && <div className="flex justify-end gap-1">
                  <button onClick={() => setForm({ id: r.id, data: r.data })} className={cx(btnSecondary, btnSm)} title={t("edit")}><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(r)} className={cx(btnDanger, btnSm)} title={t("delete")}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

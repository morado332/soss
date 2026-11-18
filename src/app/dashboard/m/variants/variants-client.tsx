"use client";
import { useCallback, useState } from "react";
import { Save, Plus, Trash2, Grid3x3, Shirt } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { Alert, Card, Empty, Field, PageHeader, btnPrimary, btnSecondary, btnSm, cx, inputCls } from "@/components/ui";

type V = { size: string; color: string; color_code?: string; stock: number; barcode?: string; sku?: string };
type P = { id: string; name: string; category: string | null; stock: number; variants: V[] | null };
const SIZES = "XS, S, M, L, XL, XXL";

export default function VariantsClient() {
  const { t, err } = useI18n();
  const [list, setList] = useState<P[]>([]);
  const [sel, setSel] = useState<string>("");
  const [vs, setVs] = useState<V[]>([]);
  const [gen, setGen] = useState({ sizes: SIZES, colors: "Schwarz, Weiß, Blau" });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const load = useCallback(async () => { const r = await api<P[]>("/api/m/variants"); if (r.ok) setList(r.data as unknown as P[]); }, []);
  useLoader(() => { load(); }, [load]);
  const pick = (id: string) => { setSel(id); setVs((list.find((p) => p.id === id)?.variants ?? []).map((v) => ({ ...v }))); setMsg(null); };
  function matrix() {
    const sizes = gen.sizes.split(",").map((s) => s.trim()).filter(Boolean), colors = gen.colors.split(",").map((s) => s.trim()).filter(Boolean);
    const have = new Set(vs.map((v) => `${v.size}|${v.color}`.toLowerCase()));
    setVs([...vs, ...sizes.flatMap((size) => colors.map((color) => ({ size, color, stock: 0 }))).filter((v) => !have.has(`${v.size}|${v.color}`.toLowerCase()))]);
  }
  async function save() {
    const r = await api<{ stock: number }>("/api/m/variants", "PATCH", { product_id: sel, variants: vs.map((v) => ({ ...v, color_code: v.color_code || undefined })) });
    setMsg(r.ok ? { tone: "success", text: t("va_saved", { n: r.data.stock }) } : { tone: "error", text: err(r.data.error) }); if (r.ok) load();
  }
  const upd = (i: number, k: keyof V, v: string | number) => setVs(vs.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const sizes = [...new Set(vs.map((v) => v.size))], colors = [...new Set(vs.map((v) => v.color))];
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav_variants")} description={t("va_sub")} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Card>
        <Field label={t("f_product")}><select value={sel} onChange={(e) => pick(e.target.value)} className={inputCls}><option value="">—</option>{list.map((p) => <option key={p.id} value={p.id}>{p.name} ({(p.variants ?? []).length} · {p.stock})</option>)}</select></Field>
      </Card>
      {!sel ? <Card><Empty icon={Shirt} text={t("va_pick")} /></Card> : <>
        <Card title={t("va_matrix")}>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label={t("va_sizes")}><input value={gen.sizes} onChange={(e) => setGen({ ...gen, sizes: e.target.value })} className={inputCls} /></Field>
            <Field label={t("va_colors")}><input value={gen.colors} onChange={(e) => setGen({ ...gen, colors: e.target.value })} className={inputCls} /></Field>
            <div className="flex items-end"><button type="button" onClick={matrix} className={btnSecondary}><Grid3x3 className="h-4 w-4" />{t("va_generate")}</button></div>
          </div>
        </Card>
        {vs.length > 0 && sizes.length > 0 && colors.length > 0 && (
          <Card title={t("va_overview")}>
            <div className="overflow-x-auto"><table className="text-sm"><thead><tr><th className="p-2"></th>{sizes.map((s) => <th key={s} className="p-2 font-semibold">{s}</th>)}</tr></thead>
              <tbody>{colors.map((c) => <tr key={c}><td className="p-2 font-medium">{c}</td>{sizes.map((s) => { const v = vs.find((x) => x.size === s && x.color === c); return <td key={s} className={cx("p-2 text-center tabular-nums", v && v.stock === 0 && "text-rose-600 font-semibold")}>{v ? v.stock : "·"}</td>; })}</tr>)}</tbody></table></div>
          </Card>
        )}
        <Card title={`${vs.length} ${t("va_variants")} · ${t("ph_stock")}: ${vs.reduce((s, v) => s + (Number(v.stock) || 0), 0)}`} action={<button onClick={save} className={btnPrimary}><Save className="h-4 w-4" />{t("save")}</button>}>
          <div className="space-y-2">
            {vs.map((v, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[90px_1fr_60px_100px_1fr_auto]">
                <input value={v.size} maxLength={20} onChange={(e) => upd(i, "size", e.target.value)} placeholder={t("va_size")} className={inputCls} />
                <input value={v.color} maxLength={30} onChange={(e) => upd(i, "color", e.target.value)} placeholder={t("va_color")} className={inputCls} />
                <input type="color" value={v.color_code || "#e2e8f0"} onChange={(e) => upd(i, "color_code", e.target.value)} className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700" title={t("va_colorCode")} />
                <input type="number" min={0} value={v.stock} onChange={(e) => upd(i, "stock", Math.max(0, Number(e.target.value)))} className={inputCls} />
                <input value={v.barcode ?? ""} maxLength={32} onChange={(e) => upd(i, "barcode", e.target.value)} placeholder={t("nav_barcode")} className={inputCls} />
                <button type="button" onClick={() => setVs(vs.filter((_, j) => j !== i))} className={cx(btnSecondary, btnSm)}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setVs([...vs, { size: "", color: "", stock: 0 }])} className={cx(btnSecondary, btnSm)}><Plus className="h-3.5 w-3.5" />{t("add")}</button>
          </div>
        </Card>
      </>}
    </div>
  );
}

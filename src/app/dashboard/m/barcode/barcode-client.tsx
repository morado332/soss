"use client";
import { useCallback, useState } from "react";
import { Printer, Wand2, Search } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { ean13Pattern, isEan13 } from "@/lib/barcode";
import { Alert, Card, PageHeader, Table, btnPrimary, btnSecondary, cx, inputCls, tdCls, thCls } from "@/components/ui";

type P = { id: string; title: string; barcode: string | null; price_cents: number };

export function Ean13({ code, height = 44 }: { code: string; height?: number }) {
  const bits = ean13Pattern(code);
  return (
    <svg viewBox={`0 0 ${bits.length + 14} ${height + 12}`} className="h-auto w-full" role="img" aria-label={code}>
      <rect width="100%" height="100%" fill="#fff" />
      {bits.split("").map((b, i) => b === "1" && <rect key={i} x={i + 7} y={2} width={1} height={i < 3 || (i >= 45 && i < 50) || i >= 92 ? height + 5 : height} fill="#000" />)}
      <text x={(bits.length + 14) / 2} y={height + 11} fontSize="8" textAnchor="middle" fontFamily="monospace" fill="#000">{code}</text>
    </svg>
  );
}

export default function BarcodeClient() {
  const { t, err, locale } = useI18n();
  const [rows, setRows] = useState<P[]>([]);
  const [copies, setCopies] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  const load = useCallback(async () => { const r = await api<P[]>("/api/m/lookup?type=product"); if (r.ok) setRows(r.data as unknown as P[]); }, []);
  useLoader(() => { load(); }, [load]);
  async function generate() {
    const r = await api<{ generated: number }>("/api/m/barcode", "POST", {});
    setMsg(r.ok ? { tone: "success", text: t("bc_generated", { n: r.data.generated }) } : { tone: "error", text: err(r.data.error) }); load();
  }
  const labels = rows.flatMap((p) => Array.from({ length: copies[p.id] ?? 0 }, () => p));
  const missing = rows.filter((p) => !p.barcode).length;
  return (
    <div className="space-y-6">
      <div className="print:hidden space-y-6">
        <PageHeader title={t("nav_barcode")} description={t("bc_sub")} actions={<>
          {missing > 0 && <button onClick={generate} className={btnSecondary}><Wand2 className="h-4 w-4" />{t("bc_generate", { n: missing })}</button>}
          <button disabled={!labels.length} onClick={() => window.print()} className={btnPrimary}><Printer className="h-4 w-4" />{t("bc_print", { n: labels.length })}</button></>} />
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Card padded={false} action={<div className="relative w-56"><Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className={cx(inputCls, "ps-8")} /></div>} title={t("bc_choose")}>
          <Table head={<><th className={thCls}>{t("name")}</th><th className={thCls}>{t("nav_barcode")}</th><th className={thCls}>{t("bc_preview")}</th><th className={thCls}>{t("bc_copies")}</th></>}>
            {rows.filter((p) => !q || `${p.title} ${p.barcode ?? ""}`.toLowerCase().includes(q.toLowerCase())).map((p) => (
              <tr key={p.id}>
                <td className={cx(tdCls, "font-medium")}>{p.title}<p className="text-xs text-slate-500">{money(p.price_cents)}</p></td>
                <td className={cx(tdCls, "font-mono text-xs")}>{p.barcode || "—"}{p.barcode && !isEan13(p.barcode) && <p className="text-amber-600">{t("bc_notEan")}</p>}</td>
                <td className={cx(tdCls, "w-40")}>{isEan13(p.barcode) && <Ean13 code={p.barcode} height={30} />}</td>
                <td className={tdCls}><input type="number" min={0} max={200} disabled={!isEan13(p.barcode)} value={copies[p.id] ?? 0} onChange={(e) => setCopies({ ...copies, [p.id]: Math.max(0, Math.min(200, Number(e.target.value))) })} className={cx(inputCls, "w-20")} /></td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      {/* print sheet: 3 labels per row */}
      <div className="hidden grid-cols-3 gap-2 print:grid">
        {labels.map((p, i) => (
          <div key={i} className="break-inside-avoid rounded border border-slate-300 p-2 text-center text-black">
            <p className="truncate text-[10px] font-semibold">{p.title}</p>
            <Ean13 code={p.barcode!} />
            <p className="text-sm font-bold">{money(p.price_cents)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

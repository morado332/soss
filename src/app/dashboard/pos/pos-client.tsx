"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { ScanBarcode, Banknote, CreditCard, Globe, Minus, Plus, Trash2, Search, CircleCheck, ShoppingCart, PackageOpen } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader, nowMs } from "@/lib/client";
import { calcSplit } from "@/lib/commission";
import { Alert, PageHeader, btnPrimary, btnSecondary, cx, inputCls, Empty } from "@/components/ui";

type Product = { id: string; name: string; barcode: string | null; price_cents: number; stock: number; category: string | null; is_active: boolean };
type CartItem = { id: string; name: string; price: number; qty: number; stock: number };
type Config = { tax_rate_bp: number; commission_percent: number; commission_fixed_cents: number };
type Result = { invoice: { number: string; total_cents: number }; tse_reference: string | null; lines: { name: string; qty: number; total: number }[] };

export default function PosClient() {
  const { t, err, locale } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [cfg, setCfg] = useState<Config>({ tax_rate_bp: 1900, commission_percent: 500, commission_fixed_cents: 30 });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<"cash" | "terminal" | "online">("cash");
  const [customer, setCustomer] = useState("");
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);
  const money = useCallback((c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" }), [locale]);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([api<Product[]>("/api/products"), api<Config>("/api/pos/checkout")]);
    if (p.ok) setProducts((p.data as unknown as Product[]).filter((x) => x.is_active));
    if (c.ok) setCfg(c.data);
  }, []);
  useLoader(() => { load(); scanRef.current?.focus(); }, [load]);

  const gross = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const split = useMemo(() => calcSplit({ grossCents: gross, percentBp: cfg.commission_percent, fixedCents: cart.length ? cfg.commission_fixed_cents : 0, taxRateBp: cfg.tax_rate_bp }), [gross, cfg, cart.length]);
  const filtered = products.filter((p) => !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.barcode === query.trim());

  function add(p: Product) {
    setResult(null);
    setCart((c) => {
      const ex = c.find((x) => x.id === p.id);
      if (ex) return c.map((x) => (x.id === p.id ? { ...x, qty: Math.min(x.qty + 1, p.stock) } : x));
      return p.stock > 0 ? [...c, { id: p.id, name: p.name, price: p.price_cents, qty: 1, stock: p.stock }] : c;
    });
  }
  function setQty(id: string, qty: number) {
    setCart((c) => c.flatMap((x) => (x.id !== id ? [x] : qty <= 0 ? [] : [{ ...x, qty: Math.min(qty, x.stock) }])));
  }
  function scan() {
    const code = query.trim();
    if (!code) return;
    const p = products.find((x) => x.barcode === code);
    if (p) { add(p); setFlash({ tone: "success", text: t("pos_added", { name: p.name }) }); setQuery(""); }
    else if (filtered.length === 1) { add(filtered[0]); setQuery(""); }
    else setFlash({ tone: "error", text: t("pos_notFound") });
    scanRef.current?.focus();
  }

  async function checkout() {
    setBusy(true); setFlash(null);
    const r = await api<Result>("/api/pos/checkout", "POST", { items: cart.map((c) => ({ product_id: c.id, quantity: c.qty })), method, customer_name: customer || undefined });
    setBusy(false);
    if (!r.ok) { setFlash({ tone: "error", text: err(r.data.error) }); return; }
    setResult(r.data); setCart([]); setCustomer(""); load();
  }

  const methods = [
    { v: "cash" as const, label: t("m_cash"), icon: Banknote },
    { v: "terminal" as const, label: t("m_terminal"), icon: CreditCard },
    { v: "online" as const, label: t("m_online"), icon: Globe },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("pos_title")} description={t("pos_sub")} />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input ref={scanRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} placeholder={t("pos_scan")} className={cx(inputCls, "h-12 ps-11 text-base")} autoComplete="off" />
            </div>
            <button onClick={scan} className={cx(btnSecondary, "h-12")}><Search className="h-4 w-4" />{t("pos_scanBtn")}</button>
          </div>
          {flash && <Alert tone={flash.tone}>{flash.text}</Alert>}
          {products.length === 0 ? <Empty icon={PackageOpen} text={t("pos_noProducts")} /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((p) => {
                const out = p.stock <= 0;
                return (
                  <button key={p.id} onClick={() => add(p)} disabled={out}
                    className="group flex min-h-28 flex-col rounded-xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:border-indigo-300 hover:shadow-md active:scale-[0.98] disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700">
                    <span className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</span>
                    <span className="mt-1 text-xs text-slate-400">{out ? t("pos_out") : t("pos_stock", { n: p.stock })}</span>
                    <span className="tabular mt-auto pt-3 text-lg font-semibold text-indigo-600 dark:text-indigo-400">{money(p.price_cents)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-24 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="h-4 w-4" />{t("pos_cart")} <span className="text-slate-400">({cart.reduce((s, i) => s + i.qty, 0)})</span></h2>
            {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-medium text-slate-500 hover:text-red-600">{t("pos_clear")}</button>}
          </div>

          {result ? (
            <div className="p-5 text-center">
              <CircleCheck className="mx-auto h-12 w-12 text-emerald-500" />
              <p className="mt-3 font-semibold">{t("pos_success", { number: result.invoice.number })}</p>
              <p className="tabular mt-1 text-2xl font-semibold">{money(result.invoice.total_cents)}</p>
              <ul className="mt-4 space-y-1 text-start text-sm text-slate-600 dark:text-slate-300">
                {result.lines.map((l, i) => <li key={i} className="flex justify-between"><span>{l.qty}× {l.name}</span><span className="tabular">{money(l.total)}</span></li>)}
              </ul>
              {result.tse_reference && <p className="mt-3 break-all rounded-md bg-slate-50 p-2 text-xs text-slate-500 dark:bg-slate-800">{t("pos_tse")}: {result.tse_reference}</p>}
              <button onClick={() => { setResult(null); scanRef.current?.focus(); }} className={cx(btnPrimary, "mt-5 w-full")}>{t("pos_newSale")}</button>
            </div>
          ) : (
            <>
              <div className="max-h-[40vh] overflow-y-auto">
                {cart.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-400">{t("pos_empty")}</p> : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cart.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="tabular text-xs text-slate-500">{money(c.price)}</p>
                        </div>
                        <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                          <button onClick={() => setQty(c.id, c.qty - 1)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white" aria-label="-"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="tabular w-7 text-center text-sm">{c.qty}</span>
                          <button onClick={() => setQty(c.id, c.qty + 1)} disabled={c.qty >= c.stock} className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 dark:hover:text-white" aria-label="+"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                        <span className="tabular w-20 text-end text-sm font-semibold">{money(c.price * c.qty)}</span>
                        <button onClick={() => setQty(c.id, 0)} className="text-slate-400 hover:text-red-600" aria-label={t("delete")}><Trash2 className="h-4 w-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-4 border-t border-slate-100 p-5 dark:border-slate-800">
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-slate-500"><dt>{t("pos_vat", { rate: `\u2066${cfg.tax_rate_bp / 100} %\u2069` })}</dt><dd className="tabular">{money(split.taxCents)}</dd></div>
                  <div className="flex justify-between text-slate-500"><dt>{t("pos_fee")}</dt><dd className="tabular"><bdi dir="ltr">−{money(split.commissionCents)}</bdi></dd></div>
                  <div className="flex justify-between text-slate-500"><dt>{t("pos_net")}</dt><dd className="tabular text-emerald-600 dark:text-emerald-400">{money(Math.max(0, split.netCents))}</dd></div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-semibold dark:border-slate-800"><dt>{t("pos_gross")}</dt><dd className="tabular">{money(gross)}</dd></div>
                </dl>
                <input value={customer} onChange={(e) => setCustomer(e.target.value)} maxLength={200} placeholder={t("pos_customer")} className={inputCls} />
                <div className="grid grid-cols-3 gap-2" role="radiogroup">
                  {methods.map((m) => (
                    <button key={m.v} role="radio" aria-checked={method === m.v} onClick={() => setMethod(m.v)}
                      className={cx("flex flex-col items-center gap-1 rounded-lg border py-2.5 text-xs font-medium transition",
                        method === m.v ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")}>
                      <m.icon className="h-5 w-5" />{m.label}
                    </button>
                  ))}
                </div>
                <button disabled={busy || !cart.length} onClick={checkout} className={cx(btnPrimary, "h-12 w-full text-base")}>
                  {busy ? t("loading") : method === "terminal" ? t("pos_payTerminal", { amount: money(gross) }) : t("pos_pay", { amount: money(gross) })}
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

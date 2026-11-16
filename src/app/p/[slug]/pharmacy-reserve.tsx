"use client";
import { useState } from "react";
import { Pill, Search, Minus, Plus, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";

type Item = { id: string; name: string; price_cents: number; rx: boolean; available: boolean };
type Info = { items: Item[]; fee_cents: number; online_payment: boolean; hold_hours: number };

/** Medicine reservation inside the public profile. Rx items: reserve only (never paid online). */
export function PharmacyReserve({ slug }: { slug: string }) {
  const { t, err, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [cart, setCart] = useState<Record<string, { item: Item; qty: number }>>({});
  const [f, setF] = useState({ customer_name: "", customer_phone: "", customer_email: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ pickup_code: string; order_id: string; rx: boolean; hold_hours: number } | null>(null);
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  useLoader(() => {
    if (!open) return;
    const h = setTimeout(async () => { const r = await api<Info>(`/api/public/pharmacy?slug=${slug}&q=${encodeURIComponent(q)}`); if (r.ok) setInfo(r.data as unknown as Info); }, 250);
    return () => clearTimeout(h);
  }, [open, q, slug]);
  const lines = Object.values(cart);
  const hasRx = lines.some((l) => l.item.rx);
  const fee = hasRx ? 0 : info?.fee_cents ?? 0;
  const add = (it: Item, d: number) => setCart((c) => {
    const qty = Math.max(0, Math.min(5, (c[it.id]?.qty ?? 0) + d)); const n = { ...c };
    if (qty === 0) delete n[it.id]; else n[it.id] = { item: it, qty }; return n;
  });
  async function reserve(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const r = await api<{ pickup_code: string; order_id: string; rx: boolean; checkout_url: string | null; hold_hours: number }>("/api/public/pharmacy", "POST", {
      slug, items: lines.map((l) => ({ product_id: l.item.id, qty: l.qty })), ...f,
    });
    setBusy(false);
    if (!r.ok) return setError(err(r.data.error));
    if (r.data.checkout_url) { window.location.href = r.data.checkout_url; return; }
    setDone(r.data); setCart({});
  }
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="bio-btn group flex w-full items-center gap-3.5 rounded-2xl px-5 py-3.5 text-start">
      <span className="bio-icon grid h-9 w-9 place-items-center rounded-xl"><Pill className="h-5 w-5" /></span>
      <span><span className="block text-sm font-semibold">{t("ph_publicTitle")}</span><span className="bio-muted block text-xs">{t("ph_publicSub")}</span></span>
    </button>
  );
  if (done) return (
    <div className="bio-btn rounded-2xl p-5 text-start text-sm">
      <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5" />{t("ph_done")}</p>
      <p className="mt-2">{t("ph_pickupCode")}: <b className="font-mono text-lg tracking-widest">{done.pickup_code}</b></p>
      <p className="bio-muted mt-1 text-xs">{t("ph_holdInfo", { h: done.hold_hours })}{done.rx ? ` ${t("ph_bringRx")}` : ""}</p>
      <a href={`/r/${done.order_id}`} className="mt-2 inline-block text-xs underline">{t("ph_status")}</a>
    </div>
  );
  return (
    <div className="bio-btn space-y-3 rounded-2xl p-4 text-start">
      <p className="flex items-center gap-2 text-sm font-semibold"><Pill className="h-4 w-4" />{t("ph_publicTitle")}</p>
      <div className="relative"><Search className="bio-muted pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ph_search")} className="bio-input with-icon" /></div>
      <ul className="max-h-64 space-y-1.5 overflow-y-auto">
        {!info ? <li className="bio-muted text-xs">{t("loading")}</li> : info.items.length === 0 ? <li className="bio-muted text-xs">{t("ph_noneFound")}</li> : info.items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{it.name}</span>
              <span className="bio-muted text-xs">{money(it.price_cents)}{it.rx && <> · <b>Rx</b></>}{!it.available && <> · {t("ph_unavailable")}</>}</span></span>
            {it.available && <span className="flex items-center gap-1">
              <button type="button" onClick={() => add(it, -1)} className="bio-icon grid h-7 w-7 place-items-center rounded-lg" aria-label="-"><Minus className="h-3.5 w-3.5" /></button>
              <span className="w-5 text-center tabular-nums">{cart[it.id]?.qty ?? 0}</span>
              <button type="button" onClick={() => add(it, 1)} className="bio-icon grid h-7 w-7 place-items-center rounded-lg" aria-label="+"><Plus className="h-3.5 w-3.5" /></button>
            </span>}
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <form onSubmit={reserve} className="space-y-2 border-t border-white/10 pt-3">
          {hasRx && <p className="flex gap-2 text-xs"><ShieldAlert className="h-4 w-4 shrink-0" />{t("ph_rxNote")}</p>}
          <input required minLength={2} maxLength={120} placeholder={t("name")} value={f.customer_name} onChange={(e) => setF({ ...f, customer_name: e.target.value })} className="bio-input" />
          <input required minLength={5} maxLength={40} pattern="[0-9+()\/\-\s]+" placeholder={t("p2_phone")} value={f.customer_phone} onChange={(e) => setF({ ...f, customer_phone: e.target.value })} className="bio-input" />
          <input type="email" maxLength={254} placeholder={`${t("email")} (${t("optional")})`} value={f.customer_email} onChange={(e) => setF({ ...f, customer_email: e.target.value })} className="bio-input" />
          <input tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
          <p className="text-xs">{fee > 0 ? (info?.online_payment ? t("ph_feeOnline", { fee: money(fee) }) : t("ph_feeAtPickup", { fee: money(fee) })) : t("ph_free")}</p>
          {error && <p className="text-xs font-semibold text-red-300">{error}</p>}
          <button disabled={busy} className="bio-icon w-full rounded-xl py-2.5 text-sm font-semibold">{fee > 0 && info?.online_payment ? t("ph_reservePay", { fee: money(fee) }) : t("ph_reserve")}</button>
        </form>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { Save, Plus, Trash2, ExternalLink, Copy, Eye } from "lucide-react";
import { useI18n } from "@/components/providers";
import { api, useLoader } from "@/lib/client";
import { ImagePicker } from "@/components/image-picker";
import { BioCard, type BioLink } from "@/components/bio-card";
import { Alert, Card, Field, PageHeader, btnPrimary, btnSecondary, btnSm, cx, inputCls } from "@/components/ui";
import type { DictKey } from "@/lib/i18n";

const THEMES = ["glass", "white", "purple", "green", "dark", "ocean", "sunset", "rose"] as const;
const SWATCH: Record<string, string> = {
  glass: "from-indigo-500 via-sky-400 to-pink-400", white: "from-slate-50 to-indigo-100", purple: "from-violet-700 to-fuchsia-500", green: "from-emerald-800 to-lime-400",
  dark: "from-zinc-950 to-zinc-700", ocean: "from-sky-900 to-cyan-400", sunset: "from-orange-700 via-rose-500 to-amber-300", rose: "from-rose-100 to-pink-300",
};
const KINDS = ["website", "instagram", "facebook", "tiktok", "youtube", "x", "linkedin", "telegram", "maps", "custom"] as const;

type P = { slug: string; display_name: string; headline: string; bio: string; avatar: string | null; theme: string; links: BioLink[]; phone: string; whatsapp: string; email: string; website: string; address: string; show_booking: boolean; show_pharmacy: boolean; published: boolean; views?: number };
type Caps = { booking: boolean; pharmacy: boolean; tenantSlug: string | null };

export function useBioLabels() {
  const { t } = useI18n();
  return { call: t("bio_call"), whatsapp: "WhatsApp", email: t("email"), website: t("bio_website"), address: t("bio_address"), book: t("bio_book"), bookSub: t("bio_bookSub") };
}

export default function ProfileEditor() {
  const { t, err } = useI18n();
  const labels = useBioLabels();
  const [p, setP] = useState<P | null>(null);
  const [caps, setCaps] = useState<Caps>({ booking: false, pharmacy: false, tenantSlug: null });
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [saved, setSaved] = useState(false);
  useLoader(() => { (async () => {
    const r = await api<{ profile: (P & { links: BioLink[] }) | null; capabilities: Caps; suggestion: { display_name: string; email: string } }>("/api/profile");
    if (!r.ok) return;
    const d = r.data; setCaps(d.capabilities); setSaved(!!d.profile?.published);
    const base = d.suggestion.display_name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "profil";
    setP(d.profile ? { ...d.profile, headline: d.profile.headline ?? "", bio: d.profile.bio ?? "", phone: d.profile.phone ?? "", whatsapp: d.profile.whatsapp ?? "", email: d.profile.email ?? "", website: d.profile.website ?? "", address: d.profile.address ?? "", links: d.profile.links ?? [] }
      : { slug: base.length >= 3 ? base : `${base}-me`, display_name: d.suggestion.display_name, headline: "", bio: "", avatar: null, theme: "glass", links: [], phone: "", whatsapp: "", email: "", website: "", address: "", show_booking: d.capabilities.booking, show_pharmacy: d.capabilities.pharmacy, published: false });
  })(); }, []);
  if (!p) return <div className="p-6 text-sm text-slate-500">{t("loading")}</div>;
  const set = <K extends keyof P>(k: K, v: P[K]) => setP({ ...p, [k]: v });
  const url = typeof window !== "undefined" ? `${window.location.origin}/p/${p.slug}` : `/p/${p.slug}`;

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!p) return;
    const { slug, display_name, headline, bio, avatar, theme, phone, whatsapp, email, website, address, show_booking, show_pharmacy, published } = p;
    const body = { slug, display_name, headline, bio, avatar, theme, phone, whatsapp, email, website, address, show_booking, show_pharmacy, published, links: p.links.filter((l) => l.url).map(({ kind, label, url }) => ({ kind, label, url })) };
    const r = await api<{ url: string }>("/api/profile", "PUT", body);
    setMsg(r.ok ? { tone: "success", text: t("p2_saved") } : { tone: "error", text: err(r.data.error) });
    if (r.ok) setSaved(p.published);
  }
  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader title={t("p2_myProfile")} description={t("bio_sub")} actions={<>
        {saved && <a href={`/p/${p.slug}`} target="_blank" rel="noopener noreferrer" className={btnSecondary}><ExternalLink className="h-4 w-4" />{t("bio_open")}</a>}
        <button className={btnPrimary}><Save className="h-4 w-4" />{t("save")}</button></>} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <div className="space-y-6">
          <Card title={t("bio_basics")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("bio_photo")} className="md:col-span-2"><ImagePicker value={p.avatar} onChange={(v) => set("avatar", v)} size={400} /></Field>
              <Field label={t("bio_displayName")}><input required minLength={2} maxLength={80} value={p.display_name} onChange={(e) => set("display_name", e.target.value)} className={inputCls} /></Field>
              <Field label={t("bio_headline")}><input maxLength={120} value={p.headline} onChange={(e) => set("headline", e.target.value)} placeholder={t("bio_headlinePh")} className={inputCls} /></Field>
              <Field label={t("bio_about")} className="md:col-span-2"><textarea rows={3} maxLength={600} value={p.bio} onChange={(e) => set("bio", e.target.value)} className={inputCls} /></Field>
              <Field label={t("bio_link")} className="md:col-span-2" hint={t("bio_slugHint")}>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">/p/</span>
                  <input required minLength={3} maxLength={40} pattern="[a-z0-9](?:[a-z0-9\-]*[a-z0-9])" value={p.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} className={inputCls} />
                  <button type="button" onClick={() => navigator.clipboard?.writeText(url)} className={cx(btnSecondary, btnSm)} title={t("bio_copy")}><Copy className="h-3.5 w-3.5" /></button>
                </div>
              </Field>
              <label className="flex items-center gap-2 text-sm font-medium md:col-span-2"><input type="checkbox" checked={p.published} onChange={(e) => set("published", e.target.checked)} />{t("bio_published")}{p.views != null && <span className="ms-auto flex items-center gap-1 text-xs text-slate-500"><Eye className="h-3.5 w-3.5" />{p.views}</span>}</label>
            </div>
          </Card>
          <Card title={t("bio_theme")}>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {THEMES.map((th) => (
                <button type="button" key={th} onClick={() => set("theme", th)} className={cx("flex flex-col items-center gap-1.5 text-xs", p.theme === th ? "font-semibold" : "text-slate-500")}>
                  <span className={cx("h-12 w-12 rounded-2xl border bg-gradient-to-br shadow-sm", SWATCH[th], p.theme === th ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900" : "border-slate-200 dark:border-slate-700")} />
                  {t(`bio_th_${th}` as DictKey)}
                </button>
              ))}
            </div>
          </Card>
          <Card title={t("bio_contact")}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t("p2_phone")}><input maxLength={40} pattern="[0-9+()\/\-\s]*" value={p.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></Field>
              <Field label="WhatsApp"><input maxLength={40} pattern="[0-9+\s]*" value={p.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+49 …" className={inputCls} /></Field>
              <Field label={t("email")}><input type="email" maxLength={254} value={p.email} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Field>
              <Field label={t("bio_website")}><input type="url" maxLength={500} value={p.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" className={inputCls} /></Field>
              <Field label={t("bio_address")} className="md:col-span-2"><input maxLength={200} value={p.address} onChange={(e) => set("address", e.target.value)} className={inputCls} /></Field>
            </div>
          </Card>
          <Card title={t("bio_links")} action={p.links.length < 12 && <button type="button" onClick={() => set("links", [...p.links, { kind: "instagram", label: "Instagram", url: "" }])} className={cx(btnSecondary, btnSm)}><Plus className="h-3.5 w-3.5" />{t("add")}</button>}>
            {p.links.length === 0 ? <p className="text-sm text-slate-500">{t("bio_noLinks")}</p> : (
              <div className="space-y-2">
                {p.links.map((l, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[140px_1fr_2fr_auto]">
                    <select value={l.kind} onChange={(e) => set("links", p.links.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))} className={inputCls}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
                    <input required maxLength={40} value={l.label} onChange={(e) => set("links", p.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} className={inputCls} />
                    <input required type="url" maxLength={500} placeholder="https://" value={l.url} onChange={(e) => set("links", p.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} className={inputCls} />
                    <button type="button" onClick={() => set("links", p.links.filter((_, j) => j !== i))} className={cx(btnSecondary, btnSm)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
          {(caps.booking || caps.pharmacy) && (
            <Card title={t("bio_features")}>
              <div className="space-y-2 text-sm">
                {caps.booking && <label className="flex items-center gap-2"><input type="checkbox" checked={p.show_booking} onChange={(e) => set("show_booking", e.target.checked)} />{t("bio_showBooking")}</label>}
                {caps.pharmacy && <label className="flex items-center gap-2"><input type="checkbox" checked={p.show_pharmacy} onChange={(e) => set("show_pharmacy", e.target.checked)} />{t("bio_showPharmacy")}</label>}
              </div>
            </Card>
          )}
        </div>
        <div className="xl:sticky xl:top-20 xl:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("bio_preview")}</p>
          <BioCard compact p={{ ...p, links: p.links.filter((l) => /^https?:\/\//.test(l.url)), website: /^https?:\/\//.test(p.website) ? p.website : "" }} labels={labels}
            booking={p.show_booking && caps.booking ? "#" : null}>
            {p.show_pharmacy && caps.pharmacy && <div className="bio-btn rounded-2xl px-5 py-3.5 text-start text-sm font-semibold">💊 {t("ph_publicTitle")}</div>}
          </BioCard>
        </div>
      </div>
    </form>
  );
}

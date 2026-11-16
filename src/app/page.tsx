import Link from "next/link";
import { Logo } from "@/components/logo";
import { ArrowRight, CalendarDays, ShoppingCart, ScanBarcode, Receipt, Calculator, Sparkles, Bell, ChartColumn, CreditCard, ShieldCheck, FileText, Landmark, Lock, ScrollText, Check, Banknote, Globe } from "lucide-react";
import { PROFESSIONS, professionName, professionTagline } from "@/lib/professions";
import { LanguageSwitcher, ThemeToggle } from "@/components/providers";
import { btnPrimary, btnSecondary, cx } from "@/components/ui";
import { getI18n, getTheme } from "@/lib/i18n-server";
import { getBranding } from "@/core/platform";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Tri = [string, string, string];
const pick = (l: Lang, v: Tri) => v[l === "de" ? 0 : l === "en" ? 1 : 2];

const MODULES: { icon: typeof CalendarDays; title: Tri; desc: Tri }[] = [
  { icon: ShoppingCart, title: ["Touch-Kasse", "Touch POS", "كاشير باللمس"], desc: ["Bar, Karte & Online — schnell, offline-tauglich und TSE-signiert.", "Cash, card & online — fast and TSE-signed.", "نقدي وبطاقة وأونلاين — سريع وموقّع بـ TSE."] },
  { icon: CalendarDays, title: ["Online-Termine", "Online booking", "حجز أونلاين"], desc: ["Öffentlicher Buchungslink mit automatischem Konflikt-Schutz.", "Public booking link with automatic conflict protection.", "رابط حجز عام مع حماية تلقائية من التعارض."] },
  { icon: ScanBarcode, title: ["Lager & Barcode", "Inventory & barcode", "المخزون والباركود"], desc: ["Barcode-Scanner, Mindestbestände und Nachbestell-Warnungen.", "Barcode scanning, reorder levels and low-stock alerts.", "مسح الباركود وحدود إعادة الطلب وتنبيهات النقص."] },
  { icon: Receipt, title: ["GoBD-Rechnungen", "GoBD invoices", "فواتير GoBD"], desc: ["Fortlaufende Nummern, unveränderbar, Korrektur per Storno.", "Sequential numbers, immutable, corrections via cancellation.", "أرقام متسلسلة وغير قابلة للتعديل والتصحيح عبر الإلغاء."] },
  { icon: Calculator, title: ["Steuerberater-Zugang", "Accountant access", "وصول المحاسب"], desc: ["DATEV-Export und Lesezugriff für Ihre Kanzlei.", "DATEV export and read access for your accountant.", "تصدير DATEV وصلاحية قراءة لمحاسبك."] },
  { icon: Sparkles, title: ["KI-Berater", "AI advisor", "المستشار الذكي"], desc: ["Umsatztrends, Bestseller und konkrete Empfehlungen.", "Revenue trends, best sellers and concrete advice.", "اتجاهات الإيرادات والأكثر مبيعاً وتوصيات عملية."] },
  { icon: ChartColumn, title: ["Berichte", "Reports", "التقارير"], desc: ["Umsatz, MwSt., Provision und Netto auf einen Blick.", "Revenue, VAT, fees and net payout at a glance.", "الإيرادات والضريبة والعمولة والصافي بنظرة واحدة."] },
  { icon: Bell, title: ["Team & Rechte", "Team & roles", "الفريق والصلاحيات"], desc: ["Mitarbeiter mit fein abgestuften Berechtigungen.", "Staff accounts with granular permissions.", "حسابات موظفين بصلاحيات دقيقة."] },
];

const COMPLIANCE: { icon: typeof Lock; title: string; desc: Tri }[] = [
  { icon: ShieldCheck, title: "KassenSichV / TSE", desc: ["Barumsätze werden über eine Cloud-TSE signiert.", "Cash sales are signed via a cloud TSE.", "المبيعات النقدية موقعة عبر TSE سحابي."] },
  { icon: Receipt, title: "GoBD", desc: ["Unveränderbare Belege mit lückenloser Nummerierung.", "Immutable records with gap-free numbering.", "سجلات غير قابلة للتعديل بترقيم متصل."] },
  { icon: FileText, title: "E-Rechnung", desc: ["XML-Export nach EN 16931 für B2B-Rechnungen.", "XML export based on EN 16931 for B2B invoices.", "تصدير XML وفق EN 16931 لفواتير الشركات."] },
  { icon: Landmark, title: "DATEV", desc: ["Buchungsstapel für Ihre Steuerkanzlei.", "Booking batches for your tax office.", "دفعات قيود لمكتب الضرائب."] },
  { icon: Lock, title: "DSGVO", desc: ["Hosting in Deutschland, Datensparsamkeit, verschlüsselte Sitzungen.", "Hosting in Germany, data minimisation, encrypted sessions.", "استضافة في ألمانيا وتقليل البيانات وجلسات مشفرة."] },
  { icon: ScrollText, title: "Audit-Log", desc: ["Jede sensible Aktion wird nachvollziehbar protokolliert.", "Every sensitive action is logged and traceable.", "كل إجراء حساس يُسجَّل ويمكن تتبعه."] },
];

const PLANS: { name: string; price: number; features: Tri[]; popular?: boolean }[] = [
  { name: "Starter", price: 29, features: [["1 Standort", "1 location", "فرع واحد"], ["Kasse & Termine", "POS & bookings", "كاشير ومواعيد"], ["GoBD-Rechnungen", "GoBD invoices", "فواتير GoBD"]] },
  { name: "Pro", price: 49, popular: true, features: [["Alles aus Starter", "Everything in Starter", "كل مزايا Starter"], ["Kartenterminal & DATEV", "Card terminal & DATEV", "جهاز بطاقات وDATEV"], ["KI-Berater", "AI advisor", "المستشار الذكي"], ["Steuerberater-Zugang", "Accountant access", "وصول المحاسب"]] },
  { name: "Business", price: 79, features: [["Alles aus Pro", "Everything in Pro", "كل مزايا Pro"], ["Unbegrenzt Mitarbeiter", "Unlimited staff", "موظفون بلا حدود"], ["Prioritäts-Support", "Priority support", "دعم بأولوية"]] },
];

export default async function Home() {
  const { t, lang } = await getI18n();
  const theme = await getTheme();
  const b = await getBranding();
  const plans = PLANS.slice(0, b.plans.length).map((p, i) => ({ ...p, name: b.plans[i].name, price: b.plans[i].price }));
  return (
    <div className="bg-white dark:bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/"><Logo /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex dark:text-slate-300">
            {b.showIndustries && <a href="#branchen" className="hover:text-slate-900 dark:hover:text-white">{t("l_navIndustries")}</a>}
            {b.showModules && <a href="#funktionen" className="hover:text-slate-900 dark:hover:text-white">{t("l_navModules")}</a>}
            {b.showCompliance && <a href="#compliance" className="hover:text-slate-900 dark:hover:text-white">{t("l_navCompliance")}</a>}
            {b.showPricing && <a href="#preise" className="hover:text-slate-900 dark:hover:text-white">{t("l_navPricing")}</a>}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <ThemeToggle initial={theme} />
            <Link href="/login" className={btnPrimary}>{t("login")}</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-0 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.25),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">🇩🇪 {t("l_badge")}</span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
              {t("l_title1")}<br /><span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400">{t("l_title2")}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">{b.tagline || t("l_sub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={cx(btnPrimary, "h-12 px-6 text-base")}>{t("l_ctaStart")}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
              <a href="#branchen" className={cx(btnSecondary, "h-12 px-6 text-base")}>{t("l_ctaIndustries")}</a>
            </div>
            <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-slate-200 pt-8 dark:border-slate-800">
              {[["14", t("l_stat1")], ["100 %", t("l_stat2")], ["7 / 19 %", t("l_stat3")]].map(([v, l]) => (
                <div key={l}><dt className="text-2xl font-semibold text-slate-900 dark:text-white">{v}</dt><dd className="mt-1 text-xs text-slate-500">{l}</dd></div>
              ))}
            </dl>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 blur-2xl" />
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl shadow-indigo-500/10 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="h-4 w-4 text-indigo-500" />{t("l_posPreview")}</p>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t("l_terminalOk")}</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[["Cappuccino", "3,40 €"], ["Croissant", "1,40 €"], ["Haarschnitt", "45,00 €"], ["T-Shirt", "19,99 €"], ["Shampoo", "14,90 €"], ["Wasser", "0,99 €"]].map(([n, p]) => (
                  <div key={n} className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50"><p className="truncate text-xs font-medium">{n}</p><p className="mt-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{p}</p></div>
                ))}
              </div>
              <dl className="mt-5 space-y-1.5 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
                <div className="flex justify-between text-slate-500"><dt>MwSt. 19 %</dt><dd>3,37 €</dd></div>
                <div className="flex justify-between text-slate-500"><dt>{t("d_commission")}</dt><dd>−1,32 €</dd></div>
                <div className="flex justify-between text-base font-semibold"><dt>{t("total")}</dt><dd>21,10 €</dd></div>
              </dl>
              <div className="mt-5 grid grid-cols-3 gap-2 text-xs font-medium">
                <span className="flex items-center justify-center gap-1.5 rounded-lg border border-indigo-500 bg-indigo-50 py-2.5 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"><Banknote className="h-4 w-4" />{t("m_cash")}</span>
                <span className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2.5 dark:border-slate-700"><CreditCard className="h-4 w-4" />{t("m_terminal")}</span>
                <span className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2.5 dark:border-slate-700"><Globe className="h-4 w-4" />{t("m_online")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {b.showIndustries && <section id="branchen" className="border-t border-slate-200 bg-slate-50 py-24 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{t("l_indTitle")}</h2><p className="mt-3 text-slate-600 dark:text-slate-400">{t("l_indSub")}</p></div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PROFESSIONS.map((p) => (
              <div key={p.key} className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-lg text-2xl" style={{ background: `${p.color}14` }}>{p.icon}</span>
                  <span className="text-xs font-medium text-slate-500">{t("l_navPricing")}: {p.monthlyFee} €{t("perMonth")}</span>
                </div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{professionName(p, lang)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{professionTagline(p, lang)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {b.showModules && <section id="funktionen" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{t("l_modTitle")}</h2><p className="mt-3 text-slate-600 dark:text-slate-400">{t("l_modSub")}</p></div>
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((m) => (
              <div key={m.title[0]}>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-600/30"><m.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{pick(lang, m.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{pick(lang, m.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {b.showCompliance && <section id="compliance" className="bg-slate-950 py-24 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-tight">{t("l_compTitle")}</h2><p className="mt-3 text-slate-400">{t("l_compSub")}</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {COMPLIANCE.map((c) => (
              <div key={c.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                <c.icon className="h-5 w-5 text-indigo-400" />
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{pick(lang, c.desc)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>}

      <section id="preise" className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {b.showPricing && <><div className="mx-auto max-w-2xl text-center"><h2 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{t("l_priceTitle")}</h2><p className="mt-3 text-slate-600 dark:text-slate-400">{t("l_priceSub")}</p></div>
          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            {plans.map((p) => (
              <div key={p.name} className={cx("relative rounded-2xl border bg-white p-8 dark:bg-slate-900", p.popular ? "border-indigo-500 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500" : "border-slate-200 dark:border-slate-800")}>
                {p.popular && <span className="absolute -top-3 start-8 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">{t("l_popular")}</span>}
                <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                <p className="mt-4"><span className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">{p.price} €</span><span className="text-sm text-slate-500">{t("perMonth")}</span></p>
                <ul className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  {p.features.map((f) => <li key={f[0]} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />{pick(lang, f)}</li>)}
                </ul>
                <Link href="/login" className={cx(p.popular ? btnPrimary : btnSecondary, "mt-8 w-full")}>{t("l_ctaStart")}</Link>
              </div>
            ))}
          </div>
          </>}
          <div className="mx-auto mt-20 max-w-5xl rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 px-8 py-14 text-center text-white">
            <h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("l_ctaTitle")}</h3>
            <p className="mt-3 text-indigo-100">{t("l_ctaSub")}</p>
            <Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow hover:bg-indigo-50">{t("login")}<ArrowRight className="h-4 w-4 rtl:rotate-180" /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-10 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3"><Logo /><span className="hidden sm:inline">· {b.footer || t("l_footer")}</span></div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {b.contactEmail && <a href={`mailto:${b.contactEmail}`} className="hover:text-slate-900 dark:hover:text-white">{b.contactEmail}</a>}
            {b.contactPhone && <a href={`tel:${b.contactPhone.replace(/\s/g, "")}`} className="hover:text-slate-900 dark:hover:text-white" dir="ltr">{b.contactPhone}</a>}
            {b.address && <span>{b.address}</span>}
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-white">{t("login")}</Link><span>© {new Date().getFullYear()} {b.siteName}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

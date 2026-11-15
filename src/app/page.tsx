import Link from "next/link";
import { PROFESSIONS, CORE_MODULES } from "@/lib/professions";
import { LanguageSwitcher } from "@/components/providers";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-extrabold text-xl tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white">A</span>
            Arena<span className="text-blue-600">.</span>
            <span className="hidden text-xs font-medium text-slate-500 sm:inline">SaaS · Deutschland</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
            <a href="#branchen" className="hover:text-blue-600">14 Branchen</a>
            <a href="#module" className="hover:text-blue-600">Module</a>
            <a href="#rechtliches" className="hover:text-blue-600">GoBD / TSE</a>
            <a href="#preise" className="hover:text-blue-600">Preise</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/login" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Anmelden</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">🇩🇪 DSGVO · GoBD · KassenSichV · TSE/Fiskaly · DATEV</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Eine Plattform.<br />14 Branchen.<br /><span className="text-blue-600">Alles in einem System.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-400">
              Kasse (POS), Online-Termine, Barcode-Lager, GoBD-Rechnungen mit TSE, automatischer Versand an Ihren Steuerberater und KI-Berichte — für Fahrschule, Friseur, Kiosk, Praxis, Apotheke, Restaurant und mehr.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="rounded-2xl bg-blue-600 px-6 py-3.5 font-semibold text-white shadow-lg hover:bg-blue-700">Demo starten →</Link>
              <a href="#branchen" className="rounded-2xl border border-slate-300 px-6 py-3.5 font-semibold dark:border-slate-700">Branchen ansehen</a>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 text-center">
              {[["14", "Branchen-Module"], ["100%", "Tenant-Isolation (RLS)"], ["7% / 19%", "MwSt. korrekt"]].map(([v, l]) => (
                <div key={l} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <dt className="text-2xl font-extrabold text-blue-600">{v}</dt><dd className="mt-1 text-xs text-slate-500">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          {/* POS mock */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <p className="font-bold">🛒 Kasse — Touch POS</p>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Terminal verbunden</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["Cola 1,50€", "Haarschnitt 45€", "Brötchen 0,80€", "Fahrstunde 45€", "T-Shirt 19,99€", "Schnitzel 14,50€"].map((x) => (
                <div key={x} className="rounded-xl bg-slate-100 p-3 text-center text-sm font-medium dark:bg-slate-800">{x}</div>
              ))}
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>Zwischensumme</span><span>65,30 €</span></div>
              <div className="flex justify-between text-slate-500"><span>MwSt. 19%</span><span>10,44 €</span></div>
              <div className="flex justify-between text-slate-500"><span>Plattform 5% + 0,30€</span><span>3,57 €</span></div>
              <div className="flex justify-between border-t pt-2 text-base font-extrabold"><span>Netto an Sie</span><span className="text-emerald-600">51,29 €</span></div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <span className="rounded-xl bg-slate-900 py-3 text-center text-sm font-semibold text-white dark:bg-white dark:text-slate-900">💵 Bar</span>
              <span className="rounded-xl bg-blue-600 py-3 text-center text-sm font-semibold text-white">💳 Terminal</span>
              <span className="rounded-xl bg-slate-100 py-3 text-center text-sm font-semibold dark:bg-slate-800">🌐 Online</span>
            </div>
            <p className="mt-3 text-center text-xs text-slate-400">Stripe Connect Split · TSE-Signatur bei Barzahlung · GoBD-unveränderbar</p>
          </div>
        </div>
      </section>

      {/* Professions */}
      <section id="branchen" className="border-y border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-extrabold">14 Branchen — jedes Geschäft sein eigenes Modul</h2>
          <p className="mt-2 text-slate-500">Jede Branche aktiviert nur ihre Module. Gemeinsame Kern-Module werden einmal gebaut und überall wiederverwendet.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PROFESSIONS.map((p) => (
              <Link key={p.key} href="/login" className="group rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between">
                  <span className="text-4xl">{p.icon}</span>
                  <span className="rounded-full px-2 py-1 text-xs font-bold text-white" style={{ background: p.color }}>{p.monthlyFee}€/Monat</span>
                </div>
                <h3 className="mt-3 font-bold">{p.nameDe}</h3>
                <p className="mt-1 text-sm text-slate-500">{p.taglineDe}</p>
                <ul className="mt-3 space-y-1 text-xs text-slate-500">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
                <p className="mt-4 text-sm font-semibold text-blue-600 group-hover:underline">Dashboard öffnen →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Core modules */}
      <section id="module" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-extrabold">Kern-Module — einmal gebaut, überall genutzt</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CORE_MODULES.map((m) => (
            <div key={m.key} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-bold">{m.nameDe}</h3><p className="mt-1 text-sm text-slate-500">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Legal */}
      <section id="rechtliches" className="border-y border-slate-200 bg-slate-900 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-extrabold">Rechtssicher für Deutschland</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              ["KassenSichV / TSE", "Barzahlung wird mit Fiskaly Cloud-TSE signiert. TSE-Seriennummer pro Geschäft."],
              ["GoBD", "Rechnungen sind unveränderbar. Korrektur nur per Storno-Rechnung. Sequenzielle Nummern pro Tenant."],
              ["E-Rechnung", "Export als XRechnung / ZUGFeRD (XML) für Behörden & Kunden."],
              ["DATEV", "Monatsexport für Ihren Steuerberater — automatisch, ohne manuelle Arbeit."],
              ["DSGVO", "Cookie-Consent, Datenexport/-löschung, Aufbewahrungsfristen. Praxisdaten: Art. 9 Schutz."],
              ["Stripe Connect", "Jeder Cent geht auf Ihr Konto. Plattform-Provision wird automatisch abgezogen (5% + 0,30€ einstellbar)."],
              ["Tenant-Isolation", "tenant_id in jeder Tabelle + PostgreSQL Row Level Security. IDOR-Tests inklusive."],
              ["Audit-Log", "Jede sensible Aktion: wer, wann, alt → neu. Inkl. Impersonation durch Root."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-3xl bg-slate-800 p-5"><h3 className="font-bold text-blue-300">{t}</h3><p className="mt-2 text-sm text-slate-300">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="preise" className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-3xl font-extrabold">Preise — nach Branche & Paket</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[["Starter", "29€", "1 Geschäft, POS, Termine, Rechnungen"], ["Pro", "49€", "Alles + Terminal, DATEV, KI-Berater"], ["Business", "79€", "Multi-Mitarbeiter, API, Prioritäts-Support"]].map(([n, p, d]) => (
            <div key={n} className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-bold">{n}</h3><p className="mt-2 text-4xl font-extrabold">{p}<span className="text-base font-medium text-slate-500">/Monat</span></p><p className="mt-2 text-sm text-slate-500">{d}</p>
              <p className="mt-3 text-xs text-slate-400">+ Plattform-Provision pro Transaktion (einstellbar, z. B. 5% + 0,30€). Stripe-Gebühren separat.</p>
            </div>
          ))}
        </div>
        <div className="mt-10 rounded-3xl bg-blue-600 p-8 text-center text-white">
          <h3 className="text-2xl font-extrabold">Bereit? Demo in 30 Sekunden.</h3>
          <p className="mt-2 text-blue-100">Root: root@platform.de / Root123! · Inhaber: owner@friseur.de / Owner123! · Steuerberater: accountant@kanzlei.de / Account123!</p>
          <Link href="/login" className="mt-5 inline-block rounded-2xl bg-white px-6 py-3 font-bold text-blue-700">Zum Login →</Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        Arena SaaS · Multi-Tenant · Next.js + PostgreSQL + Drizzle · Stripe Connect · Fiskaly TSE · Claude KI · DSGVO
        <div className="mt-2 flex justify-center gap-4"><Link href="/login" className="hover:underline">Login</Link><Link href="/book/friseur" className="hover:underline">Demo-Buchung</Link><span>العربية · English · Deutsch (RTL)</span></div>
      </footer>
    </main>
  );
}

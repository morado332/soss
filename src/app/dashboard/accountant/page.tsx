import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/db";
import { tenants, accountant_links, invoices, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { eur } from "@/lib/commission";
import { Card, Empty, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AccountantPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  if (user.role === "accountant") {
    const links = await db.select().from(accountant_links).where(eq(accountant_links.accountant_user_id, user.id));
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-extrabold">🧮 Steuerberater — Mandanten</h1><p className="text-sm text-slate-500">Accountant ID: <b>{user.accountant_id}</b> · Sie sehen nur zugeordnete Mandanten. Monatsdaten kommen automatisch (kein manuelles Senden nötig).</p></div>
        {links.map(async (l) => {
          const [t] = await db.select().from(tenants).where(eq(tenants.id, l.tenant_id)).limit(1);
          if (!t) return null;
          const [cnt] = await db.select({ v: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.tenant_id, t.id));
          const [sum] = await db.select({ v: sql<number>`coalesce(sum(total_cents),0)::int` }).from(invoices).where(eq(invoices.tenant_id, t.id));
          return (
            <Card key={l.id} title={`📁 ${t.name}`} action={<Badge tone="green">Mandantenakte</Badge>}>
              <p className="text-sm text-slate-500">{t.profession} · {cnt.v} Rechnungen · Umsatz {eur(sum.v)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="/api/exports?format=datev" className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white">DATEV Export</a>
                <a href="/api/exports?format=xrechnung" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">XRechnung</a>
              </div>
              <p className="mt-3 text-xs text-slate-400">Prüfstatus: offen · Fehlende Unterlagen: keine · Nächster Monatsversand: automatisch am 1. des Folgemonats.</p>
            </Card>
          );
        })}
        {links.length === 0 && <Empty text="Keine Mandanten. Mandanten verknüpfen sich über Ihre Accountant ID." />}
      </div>
    );
  }

  if (!user.tenant_id) redirect("/login");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenant_id)).limit(1);
  const myAccountants = await db.select().from(users).where(eq(users.role, "accountant"));
  const [cnt] = await db.select({ v: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.tenant_id, user.tenant_id));
  const [sum] = await db.select({ v: sql<number>`coalesce(sum(total_cents),0)::int` }).from(invoices).where(eq(invoices.tenant_id, user.tenant_id));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold">🧮 Steuerberater</h1><p className="text-sm text-slate-500">Am Monatsende werden alle Rechnungen (Verkauf & Einkauf) automatisch an Ihren Steuerberater gesendet — in der Plattform oder per E-Mail (ZIP + PDF + CSV/DATEV).</p></div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="📤 Monatsversand"><p className="text-3xl font-extrabold">{cnt.v} Rechnungen</p><p className="text-sm text-slate-500">Gesamt {eur(sum.v)} · automatisch</p></Card>
        <Card title="⬇ DATEV"><a href="/api/exports?format=datev" className="inline-block rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white">CSV herunterladen</a><p className="mt-2 text-xs text-slate-400">DATEV Storno-Format für Ihr Steuerbüro.</p></Card>
        <Card title="⬇ XRechnung"><a href="/api/exports?format=xrechnung" className="inline-block rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">XML herunterladen</a><p className="mt-2 text-xs text-slate-400">E-Rechnung (EN 16931 / ZUGFeRD).</p></Card>
      </div>
      <Card title="👤 Steuerberater wählen (aus der Plattform)">
        {myAccountants.length === 0 ? <Empty text="Keine Steuerberater in der Plattform." /> : myAccountants.map((a) => (
          <div key={a.id} className="flex items-center justify-between border-b py-3 text-sm last:border-0 dark:border-slate-800">
            <span><b>{a.name}</b> <span className="text-slate-400">· ID {a.accountant_id} · {a.email}</span></span>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">Verknüpfen per ID</span>
          </div>
        ))}
        <p className="mt-3 text-xs text-slate-400">Externer Steuerberater? Einfach E-Mail eingeben — der Monatsversand geht dann per E-Mail (ZIP + PDF + CSV/DATEV). Aktuell verknüpft: {tenant?.name ?? "—"}.</p>
      </Card>
    </div>
  );
}

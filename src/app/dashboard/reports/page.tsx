import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/db";
import { transactions, tenants } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { eur, platformFeeInvoice } from "@/lib/commission";
import { Card, Stat, Empty, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await currentUser();
  if (!user?.tenant_id) redirect("/login");
  const tid = user.tenant_id;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [rev] = await db.select({ v: sql<number>`coalesce(sum(amount_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const [tax] = await db.select({ v: sql<number>`coalesce(sum(tax_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const [comm] = await db.select({ v: sql<number>`coalesce(sum(commission_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const [net] = await db.select({ v: sql<number>`coalesce(sum(net_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const byMethod = await db.select({ method: transactions.method, v: sql<number>`coalesce(sum(amount_cents),0)::int`, c: sql<number>`count(*)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart))).groupBy(transactions.method);
  const all = await db.select().from(transactions).where(eq(transactions.tenant_id, tid)).orderBy(transactions.created_at).limit(30);
  const fee = platformFeeInvoice(comm.v);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold">📈 Berichte — Umsatz, Gewinn, Split</h1><p className="text-sm text-slate-500">Jede Transaktion zeigt: Brutto · MwSt. · Plattform-Provision · Netto an Sie. Snapshots bleiben korrekt, auch wenn sich Sätze später ändern.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Brutto (Monat)" value={eur(rev.v)} />
        <Stat label="MwSt. (7%/19%)" value={eur(tax.v)} />
        <Stat label="Provision" value={eur(comm.v)} color="#dc2626" />
        <Stat label="Netto an Sie" value={eur(net.v)} color="#059669" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="💳 Nach Zahlungsart">
          {byMethod.length === 0 ? <Empty text="Keine Daten." /> : byMethod.map((m) => (
            <div key={m.method} className="flex justify-between border-b py-2.5 text-sm last:border-0 dark:border-slate-800"><span className="capitalize">{m.method} <span className="text-slate-400">({m.c}×)</span></span><b>{eur(m.v)}</b></div>
          ))}
          <p className="mt-3 text-xs text-slate-400">Bar = TSE-signiert, ohne Stripe. Karte/Terminal/Online = Stripe Connect Split auf Ihr Konto.</p>
        </Card>
        <Card title="🧾 Plattform-Monatsrechnung (Vorschau)">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Provisionen gesamt</dt><dd>{eur(fee.commission)}</dd></div>
            <div className="flex justify-between"><dt>MwSt. 19% auf Provision</dt><dd>{eur(fee.vat)}</dd></div>
            <div className="flex justify-between border-t pt-2 font-extrabold"><dt>Rechnungsbetrag</dt><dd>{eur(fee.total)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-slate-400">Wird am Monatsende automatisch erstellt & versendet. Abonnement: {eur(tenant?.monthly_fee_cents ?? 0)}/Monat ({tenant?.plan}).</p>
        </Card>
      </div>
      <Card title="📋 Alle Transaktionen (30)">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500"><tr><th className="p-2 text-start">Datum</th><th className="p-2 text-start">Methode</th><th className="p-2 text-start">Brutto</th><th className="p-2 text-start">MwSt.</th><th className="p-2 text-start">Provision</th><th className="p-2 text-start">Netto</th><th className="p-2 text-start">Snapshot</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {all.map((t) => (
                <tr key={t.id}><td className="p-2">{new Date(t.created_at).toLocaleDateString("de-DE")}</td><td className="p-2"><Badge>{t.method}</Badge></td><td className="p-2 font-bold">{eur(t.amount_cents)}</td><td className="p-2">{eur(t.tax_cents)}</td><td className="p-2">{eur(t.commission_cents)}</td><td className="p-2 font-semibold text-emerald-600">{eur(t.net_cents)}</td><td className="p-2 text-xs text-slate-400">{JSON.stringify(t.commission_snapshot)}</td></tr>
              ))}
            </tbody>
          </table>
          {all.length === 0 && <Empty text="Noch keine Transaktionen." />}
        </div>
      </Card>
    </div>
  );
}

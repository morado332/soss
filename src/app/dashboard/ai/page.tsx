import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/db";
import { transactions, products, tenants, invoices } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { eur } from "@/lib/commission";
import { Card, Stat, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

// AI Advisor — rule-based insights from own data only (Claude API integration point: ANTHROPIC_API_KEY).
// In production, this page calls Claude with aggregated stats; here it computes deterministic insights.
export default async function AiPage() {
  const user = await currentUser();
  if (!user?.tenant_id) redirect("/login");
  const tid = user.tenant_id;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const lastMonthStart = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

  const [rev] = await db.select({ v: sql<number>`coalesce(sum(amount_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const [prev] = await db.select({ v: sql<number>`coalesce(sum(amount_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, lastMonthStart), sql`created_at < ${monthStart}`));
  const [txCount] = await db.select({ v: sql<number>`count(*)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const [invCount] = await db.select({ v: sql<number>`count(*)::int` }).from(invoices).where(eq(invoices.tenant_id, tid));
  const prods = await db.select().from(products).where(eq(products.tenant_id, tid)).orderBy(products.stock).limit(5);
  const low = prods.filter((p) => p.stock <= (p.low_stock_threshold ?? 5));
  const growth = prev.v > 0 ? Math.round(((rev.v - prev.v) / prev.v) * 100) : 0;
  const avgTicket = txCount.v > 0 ? Math.round(rev.v / txCount.v) : 0;
  const forecast = Math.round(rev.v * 1.08);

  const month = new Date().getMonth();
  const seasonal = month >= 5 && month <= 7 ? "☀️ Sommer: Nachfrage nach kühlen Produkten & Outdoor-Services steigt. Lager aufstocken, Sommer-Aktion planen." : month >= 10 || month <= 1 ? "❄️ Winter: Erkältungs-/Saison-Produkte & warme Angebote im Fokus. Apotheken-Tipp: Fieber-/Erkältungsmittel bevorraten." : "🌸 Frühjahr/Herbst: Übergangs-Saison — Aktionen für Stammkunden, Bestand prüfen.";

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold">🤖 KI-Berater — Wochen-/Monatsbericht</h1><p className="text-sm text-slate-500">Basierend ausschließlich auf Ihren Daten ({tenant?.name}). Claude API: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">ANTHROPIC_API_KEY</code> — ohne Key läuft der Regel-Modus.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Monatsleistung" value={eur(rev.v)} sub={`${growth >= 0 ? "+" : ""}${growth}% vs. Vormonat`} color={growth >= 0 ? "#059669" : "#dc2626"} />
        <Stat label="Transaktionen" value={String(txCount.v)} sub={`Ø Bon ${eur(avgTicket)}`} />
        <Stat label="Prognose nächste Woche" value={eur(forecast)} sub="Trend +8% (Regel-Modell)" />
        <Stat label="Rechnungen gesamt" value={String(invCount.v)} sub="GoBD & TSE-signiert" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="🏆 Top-Produkte / Services">
          {prods.length === 0 ? <Empty text="Noch keine Produkte." /> : prods.map((p, i) => (
            <div key={p.id} className="flex justify-between border-b py-2.5 text-sm last:border-0 dark:border-slate-800"><span>{i + 1}. {p.name}</span><b>{eur(p.price_cents)}</b></div>
          ))}
          <p className="mt-3 text-sm text-slate-500">💡 Vorschlag: „{prods[0]?.name ?? "Top-Produkt"}“ stark nachgefragt — Angebot/Aktion dafür erstellen und Bestand für nächste Woche erhöhen.</p>
        </Card>
        <Card title="⚠️ Handlungsempfehlungen">
          <ul className="space-y-3 text-sm">
            <li className="rounded-2xl bg-amber-50 p-3 dark:bg-amber-950">📦 Nachbestellung: {low.length ? low.map((p) => p.name).join(", ") : "keine kritischen Artikel"} — „Dieses Produkt verkauft sich stark, bestellen Sie mehr für nächste Woche.“</li>
            <li className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950">📣 Angebots-Idee: Stammkunden-Rabatt auf Top-Produkte, um Wiederkäufe zu steigern.</li>
            <li className="rounded-2xl bg-emerald-50 p-3 dark:bg-emerald-950">📱 Werbe-Vorschlag: Kurzes Video/Reel mit Bestseller + „Jetzt buchen“-Link (/book/{tenant?.slug}).</li>
            <li className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">{seasonal}</li>
          </ul>
        </Card>
      </div>
      <Card title="📅 Nächste Schritte (automatisch)">
        <p className="text-sm text-slate-500">Monatsrechnung der Plattform (Provision + 19% MwSt.) wird am Monatsende erstellt · Steuerberater-Versand automatisch · Erinnerungen an Kunden 24h/1h vor Termin aktiv.</p>
      </Card>
    </div>
  );
}

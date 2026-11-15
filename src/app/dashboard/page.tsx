import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/db";
import { tenants, transactions, appointments, products, invoices, orders, queue_tickets, projects, gigs, loans, school_classes, recipes, accountant_links } from "@/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { eur } from "@/lib/commission";
import { professionByKey } from "@/lib/professions";
import { Card, Stat, Badge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  // Accountant view: linked clients only
  if (user.role === "accountant") {
    const links = await db.select().from(accountant_links).where(eq(accountant_links.accountant_user_id, user.id));
    const clientTenants = [];
    for (const l of links) {
      const [t] = await db.select().from(tenants).where(eq(tenants.id, l.tenant_id)).limit(1);
      if (t) clientTenants.push(t);
    }
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-extrabold">Mandanten — {user.accountant_id}</h1><p className="text-sm text-slate-500">Sie sehen ausschließlich Ihre zugeordneten Mandanten. Jede Mandantenakte ist vollständig getrennt.</p></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clientTenants.map((t) => {
            const p = professionByKey(t.profession);
            return (
              <Card key={t.id} title={`${p.icon} ${t.name}`}>
                <p className="text-sm text-slate-500">{p.nameDe} · {t.status}</p>
                <div className="mt-3 flex gap-2">
                  <a href={`/api/exports?format=datev`} className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white">DATEV Export</a>
                  <a href={`/api/exports?format=xrechnung`} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">XRechnung</a>
                </div>
                <p className="mt-3 text-xs text-slate-400">Monatsversand: automatisch am Monatsende (Rechnungen Kauf/Verkauf).</p>
              </Card>
            );
          })}
        </div>
        {clientTenants.length === 0 && <Empty text="Keine Mandanten zugeordnet. Mandanten verknüpfen sich über Ihre Accountant ID." />}
      </div>
    );
  }

  if (!user.tenant_id) redirect("/login");
  const tid = user.tenant_id;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
  if (!tenant) redirect("/login");
  const prof = professionByKey(tenant.profession);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [rev] = await db.select({ v: sql<number>`coalesce(sum(amount_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const [comm] = await db.select({ v: sql<number>`coalesce(sum(commission_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const [net] = await db.select({ v: sql<number>`coalesce(sum(net_cents),0)::int` }).from(transactions).where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, monthStart)));
  const todayAppts = await db.select().from(appointments).where(and(eq(appointments.tenant_id, tid), gte(appointments.starts_at, new Date(new Date().setHours(0, 0, 0, 0))))).orderBy(appointments.starts_at).limit(8);
  const lowStock = await db.select().from(products).where(eq(products.tenant_id, tid)).then((rows) => rows.filter((r) => r.stock <= (r.low_stock_threshold ?? 5)));
  const recentTx = await db.select().from(transactions).where(eq(transactions.tenant_id, tid)).orderBy(transactions.created_at).limit(6);
  const recentInv = await db.select().from(invoices).where(eq(invoices.tenant_id, tid)).orderBy(invoices.issued_at).limit(5);
  const myOrders = await db.select().from(orders).where(eq(orders.tenant_id, tid)).orderBy(orders.created_at).limit(5);
  const myTickets = await db.select().from(queue_tickets).where(eq(queue_tickets.tenant_id, tid)).orderBy(queue_tickets.number).limit(6);
  const myProjects = await db.select().from(projects).where(eq(projects.tenant_id, tid)).limit(4);
  const myGigs = await db.select().from(gigs).where(eq(gigs.tenant_id, tid)).limit(4);
  const myLoans = await db.select().from(loans).where(eq(loans.tenant_id, tid)).limit(4);
  const myClasses = await db.select().from(school_classes).where(eq(school_classes.tenant_id, tid)).limit(4);
  const myRecipes = await db.select().from(recipes).where(eq(recipes.tenant_id, tid)).limit(4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{prof.icon} {tenant.name}</h1>
          <p className="text-sm text-slate-500">{prof.nameDe} · Paket {tenant.plan} · {eur(tenant.monthly_fee_cents)}/Monat · Provision {(tenant.commission_percent ?? 500) / 100}% + {eur(tenant.commission_fixed_cents ?? 30)}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone={tenant.status === "active" ? "green" : tenant.status === "suspended" ? "red" : "amber"}>{tenant.status}</Badge>
          <Link href={`/book/${tenant.slug}`} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">🌐 Öffentlicher Buchungslink</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Umsatz (Monat)" value={eur(rev.v)} sub="Brutto inkl. MwSt." />
        <Stat label="Plattform-Provision" value={eur(comm.v)} sub="Wird in Monatsrechnung +19% MwSt. abgerechnet" color="#dc2626" />
        <Stat label="Netto an Sie" value={eur(net.v)} sub="Nach MwSt. & Provision (Stripe Connect)" color="#059669" />
        <Stat label="Termine heute" value={String(todayAppts.length)} sub="Erinnerung 24h & 1h automatisch" />
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="font-bold text-amber-800 dark:text-amber-200">⚠️ Lagerwarnung — bitte nachbestellen:</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{lowStock.map((p) => `${p.name} (${p.stock} Stk.)`).join(" · ")}</p>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="📅 Termine heute" action={<Link href="/dashboard/appointments" className="text-sm font-semibold text-blue-600">Alle →</Link>}>
          {todayAppts.length === 0 ? <Empty text="Keine Termine heute." /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {todayAppts.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span><b>{a.customer_name}</b> <span className="text-slate-400">· {a.source}</span></span>
                  <span className="text-slate-500">{new Date(a.starts_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                  <Badge tone={a.status === "confirmed" ? "green" : "slate"}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="💳 Letzte Transaktionen (Split sichtbar)" action={<Link href="/dashboard/reports" className="text-sm font-semibold text-blue-600">Berichte →</Link>}>
          {recentTx.length === 0 ? <Empty text="Noch keine Verkäufe. Nutzen Sie die Kasse (POS)." /> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTx.map((t) => (
                <li key={t.id} className="py-2.5 text-sm">
                  <div className="flex justify-between"><span className="font-semibold">{eur(t.amount_cents)}</span><Badge>{t.method}</Badge></div>
                  <div className="mt-1 flex justify-between text-xs text-slate-500"><span>MwSt. {eur(t.tax_cents)} · Provision {eur(t.commission_cents)}</span><span className="font-semibold text-emerald-600">Netto {eur(t.net_cents)}</span></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Profession-specific modules */}
      {tenant.profession === "praxis" && (
        <Card title="🩺 Warteschlange (Ticket-System)" action={<Link href="/dashboard/appointments" className="text-sm font-semibold text-blue-600">Verwalten →</Link>}>
          {myTickets.length === 0 ? <Empty text="Keine Tickets." /> : <div className="flex flex-wrap gap-2">{myTickets.map((t) => <span key={t.id} className="rounded-2xl bg-slate-100 px-4 py-2 font-bold dark:bg-slate-800">#{t.number} {t.patient_name ?? ""} · {t.status}</span>)}</div>}
        </Card>
      )}
      {tenant.profession === "design" && (
        <Card title="🎨 Projekte & Aufgaben">
          {myProjects.length === 0 ? <Empty text="Keine Projekte." /> : myProjects.map((p) => <p key={p.id} className="py-1 text-sm"><b>{p.name}</b> — {p.client_name} · Deadline {p.deadline ? new Date(p.deadline).toLocaleDateString("de-DE") : "—"} · {eur(p.amount_cents ?? 0)}</p>)}
        </Card>
      )}
      {tenant.profession === "kuenstler" && (
        <Card title="🎤 Auftritte (Gigs)">
          {myGigs.length === 0 ? <Empty text="Keine Gigs." /> : myGigs.map((g) => <p key={g.id} className="py-1 text-sm"><b>{g.title}</b> — {g.venue} · {new Date(g.gig_date).toLocaleDateString("de-DE")} · Gage {eur(g.fee_cents ?? 0)} · Anzahlung {eur(g.deposit_cents ?? 0)}</p>)}
        </Card>
      )}
      {tenant.profession === "buchhandlung" && (
        <Card title="📚 Ausleihe">
          {myLoans.length === 0 ? <Empty text="Keine Ausleihen." /> : myLoans.map((l) => <p key={l.id} className="py-1 text-sm"><b>{l.book_title}</b> — {l.member_name} · fällig {new Date(l.due_at).toLocaleDateString("de-DE")}</p>)}
        </Card>
      )}
      {tenant.profession === "schule" && (
        <Card title="🎓 Klassen & Stundenplan">
          {myClasses.length === 0 ? <Empty text="Keine Klassen." /> : myClasses.map((c) => <p key={c.id} className="py-1 text-sm"><b>Klasse {c.name}</b> — {c.teacher_name} · {JSON.stringify(c.schedule)}</p>)}
        </Card>
      )}
      {tenant.profession === "baeckerei" && (
        <Card title="🥖 Rezepte (Mehl → Brot)">
          {myRecipes.length === 0 ? <Empty text="Keine Rezepte." /> : myRecipes.map((r) => <p key={r.id} className="py-1 text-sm"><b>{r.name}</b> — {(r.flour_kg_per_loaf ?? 350)}g Mehl pro Brot</p>)}
        </Card>
      )}
      {(tenant.profession === "apotheke" || tenant.profession === "restaurant") && (
        <Card title="📦 Online-Bestellungen">
          {myOrders.length === 0 ? <Empty text="Keine Bestellungen." /> : myOrders.map((o) => <p key={o.id} className="py-1 text-sm"><b>{o.customer_name}</b> · {o.source} · {eur(o.total_cents)} · {o.status}{o.requires_prescription ? " · ⚠️ Rezept bei Abholung" : ""}</p>)}
        </Card>
      )}

      <Card title="🧾 Letzte Rechnungen (GoBD — unveränderbar, Storno statt Löschen)" action={<Link href="/dashboard/invoices" className="text-sm font-semibold text-blue-600">Alle →</Link>}>
        {recentInv.length === 0 ? <Empty text="Noch keine Rechnungen." /> : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentInv.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span><b>{i.number}</b> · {i.customer_name ?? "—"} {i.tse_reference ? <span className="text-xs text-slate-400">· TSE ✓</span> : null}</span>
                <span className="font-semibold">{eur(i.total_cents)}</span>
                <Badge tone={i.status === "paid" ? "green" : i.status === "storno" ? "red" : "slate"}>{i.type === "storno" ? "Storno" : i.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, gte, lt, sql, count } from "drizzle-orm";
import { Banknote, Percent, Wallet, CalendarDays, ShoppingCart, Receipt, Package, Download, FileText, TriangleAlert, ArrowRight, Users, CalendarClock, GraduationCap } from "lucide-react";
import { tenantModules } from "@/lib/guard";
import type { ModuleKey } from "@/modules/registry";
import { FahrschuleHome } from "@/modules/fahrschule/ui/home";
import { currentUser, hasPermission, isPlatformAdmin } from "@/lib/auth";
import { db } from "@/db";
import { tenants, transactions, appointments, products, invoices, orders, queue_tickets, projects, gigs, loans, school_classes, recipes, accountant_links } from "@/db/schema";
import { eur } from "@/lib/commission";
import { professionByKey, professionName } from "@/lib/professions";
import { Card, Stat, Badge, Empty, PageHeader, statusTone, btnPrimary, btnSecondary, btnSm, Alert } from "@/components/ui";
import { RevenueBars } from "@/components/revenue-bars";
import { getI18n } from "@/lib/i18n-server";
import { monthTotals, dailyRevenue } from "@/lib/stats";
import type { DictKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (isPlatformAdmin(user)) redirect("/root");
  const { t, lang, locale } = await getI18n();
  const money = (c: number) => eur(c, locale);
  const st = (s: string) => t(`st_${s}` as DictKey);

  // ---------- Accountant: linked clients only ----------
  if (user.role === "accountant") {
    const clients = await db.select({
      id: tenants.id, name: tenants.name, profession: tenants.profession, status: tenants.status,
      invoices: sql<number>`(select count(*)::int from invoices i where i.tenant_id = "tenants"."id")`,
      revenue: sql<number>`(select coalesce(sum(total_cents),0)::bigint from invoices i where i.tenant_id = "tenants"."id" and i.issued_at >= date_trunc('month', now()))`,
    }).from(accountant_links).innerJoin(tenants, eq(accountant_links.tenant_id, tenants.id))
      .where(and(eq(accountant_links.accountant_user_id, user.id), eq(accountant_links.status, "active"))).orderBy(asc(tenants.name));
    const now = new Date();
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    return (
      <div className="space-y-6">
        <PageHeader title={t("acc_clientsTitle")} description={t("acc_clientsSub")} actions={<Badge tone="violet">{t("acc_yourId")}: {user.accountant_id}</Badge>} />
        {clients.length === 0 ? <Empty icon={Users} text={t("acc_noClients", { id: user.accountant_id ?? "" })} /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clients.map((c) => {
              const p = professionByKey(c.profession);
              const qs = `tenant_id=${c.id}&from=${prevFrom}&to=${prevTo}`;
              return (
                <Card key={c.id} title={<span className="flex items-center gap-2"><span>{p.icon}</span>{c.name}</span>} description={professionName(p, lang)} action={<Badge tone={statusTone(c.status)}>{st(c.status)}</Badge>}>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-slate-500">{t("nav_invoices")}</dt><dd className="tabular font-semibold">{c.invoices}</dd></div>
                    <div><dt className="text-xs text-slate-500">{t("d_revenue")}</dt><dd className="tabular font-semibold">{money(Number(c.revenue))}</dd></div>
                  </dl>
                  <p className="mt-4 text-xs font-medium text-slate-500">{t("acc_monthly")} ({prevFrom.slice(0, 7)})</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a href={`/api/exports?format=datev&${qs}`} className={`${btnPrimary} ${btnSm}`}><Download className="h-3.5 w-3.5" />DATEV</a>
                    <a href={`/api/exports?format=xml&${qs}`} className={`${btnSecondary} ${btnSm}`}><FileText className="h-3.5 w-3.5" />XML</a>
                    <a href={`/api/exports?format=datev&tenant_id=${c.id}`} className={`${btnSecondary} ${btnSm}`}>{t("all")}</a>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------- Tenant owner / staff ----------
  if (!user.tenant_id) redirect("/login");
  const tid = user.tenant_id;
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tid)).limit(1);
  if (!tenant) redirect("/login");
  const prof = professionByKey(tenant.profession);
  const can = (p: string) => hasPermission(user, p);
  // Only widgets of this business type's modules are shown (src/modules/registry.ts).
  const mods = await tenantModules(tenant);
  const has = (m: ModuleKey) => mods.has(m);
  const showMoney = can("reports:read") && has("pos");
  const showInvoices = can("invoices:read") && has("invoices");
  // A driving school's appointments are its lessons — shown in its own overview instead.
  const showAppts = has("appointments") && !has("fahrschule") && can("appointments:read");

  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const [totals, daily, todayAppts, lowStock, recentTx, recentInv] = await Promise.all([
    monthTotals(tid), dailyRevenue(tid, 14),
    db.select().from(appointments).where(and(eq(appointments.tenant_id, tid), gte(appointments.starts_at, dayStart), lt(appointments.starts_at, dayEnd))).orderBy(asc(appointments.starts_at)).limit(10),
    db.select({ id: products.id, name: products.name, stock: products.stock }).from(products).where(and(eq(products.tenant_id, tid), eq(products.is_active, true), sql`${products.stock} <= coalesce(${products.low_stock_threshold}, 5)`)).limit(10),
    db.select().from(transactions).where(eq(transactions.tenant_id, tid)).orderBy(desc(transactions.created_at)).limit(6),
    db.select().from(invoices).where(eq(invoices.tenant_id, tid)).orderBy(desc(invoices.issued_at)).limit(6),
  ]);

  const p = tenant.profession;
  const [myOrders, myTickets, myProjects, myGigs, myLoans, myClasses, myRecipes] = await Promise.all([
    p === "apotheke" || p === "restaurant" ? db.select().from(orders).where(eq(orders.tenant_id, tid)).orderBy(desc(orders.created_at)).limit(5) : [],
    p === "praxis" ? db.select().from(queue_tickets).where(and(eq(queue_tickets.tenant_id, tid), sql`${queue_tickets.status} <> 'done'`)).orderBy(asc(queue_tickets.number)).limit(8) : [],
    p === "design" ? db.select().from(projects).where(eq(projects.tenant_id, tid)).limit(5) : [],
    p === "kuenstler" ? db.select().from(gigs).where(eq(gigs.tenant_id, tid)).orderBy(asc(gigs.gig_date)).limit(5) : [],
    p === "buchhandlung" ? db.select().from(loans).where(eq(loans.tenant_id, tid)).limit(5) : [],
    p === "schule" ? db.select().from(school_classes).where(eq(school_classes.tenant_id, tid)).limit(5) : [],
    p === "baeckerei" ? db.select().from(recipes).where(eq(recipes.tenant_id, tid)).limit(5) : [],
  ]);
  const [{ value: apptCount }] = await db.select({ value: count() }).from(appointments).where(and(eq(appointments.tenant_id, tid), gte(appointments.starts_at, dayStart), lt(appointments.starts_at, dayEnd)));

  const time = (d: Date) => new Date(d).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const date = (d: Date) => new Date(d).toLocaleDateString(locale);

  const quick = [
    has("fahrschule") && can("appointments:write") && { href: "/dashboard/m/fahrschule/lessons", label: t("fs_new_lesson"), icon: CalendarClock },
    has("fahrschule") && can("fahrschule:manage") && { href: "/dashboard/m/fahrschule/students", label: t("fs_new_student"), icon: GraduationCap },
    has("pos") && can("pos:use") && { href: "/dashboard/pos", label: t("qa_sale"), icon: ShoppingCart },
    has("appointments") && can("appointments:write") && { href: "/dashboard/appointments", label: t("qa_appt"), icon: CalendarDays },
    has("invoices") && can("invoices:write") && { href: "/dashboard/invoices", label: t("qa_invoice"), icon: Receipt },
    has("products") && can("products:write") && { href: "/dashboard/products", label: t("qa_product"), icon: Package },
  ].filter(Boolean) as { href: string; label: string; icon: typeof ShoppingCart }[];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("d_greeting", { name: user.name.split(" ")[0] })}
        description={<>{prof.icon} {tenant.name} · {professionName(prof, lang)} · {t("d_plan")} {tenant.plan}</>}
        actions={<Badge tone={statusTone(tenant.status)}>{st(tenant.status)}</Badge>}
      />

      {has("fahrschule") && <FahrschuleHome tenantId={tid} t={t} locale={locale} />}

      {(showMoney || showAppts) && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showMoney && <Stat label={t("d_revenue")} value={money(totals.gross)} sub={t("d_revenueSub")} icon={Banknote} />}
        {showMoney && <Stat label={t("d_commission")} value={money(totals.fee)} sub={`${((tenant.commission_percent ?? 500) / 100).toLocaleString(locale)} % + ${money(tenant.commission_fixed_cents ?? 30)}`} icon={Percent} tone="rose" />}
        {showMoney && <Stat label={t("d_net")} value={money(totals.net)} sub={t("d_netSub")} icon={Wallet} tone="emerald" />}
        {showAppts && <Stat label={t("d_today")} value={String(apptCount)} sub={t("d_todaySub")} icon={CalendarDays} tone="sky" />}
      </div>}

      {quick.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {quick.slice(0, 4).map((q) => (
            <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"><q.icon className="h-5 w-5" /></span>
              <span className="flex-1 text-sm font-medium">{q.label}</span>
              <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500 rtl:rotate-180" />
            </Link>
          ))}
        </div>
      )}

      {has("products") && lowStock.length > 0 && (
        <Alert tone="warning" icon={TriangleAlert}>
          <b>{t("d_lowStock")}:</b> {t("d_lowStockText")} {lowStock.map((x) => `${x.name} (${x.stock})`).join(" · ")}
        </Alert>
      )}

      {(showMoney || showAppts) && <div className="grid gap-6 xl:grid-cols-3">
        {showMoney && (
          <Card title={t("r_last7")} className="xl:col-span-2">
            <RevenueBars data={daily} locale={locale} label={t("r_last7")} />
          </Card>
        )}
        {showAppts && <Card title={t("d_today")} action={<Link href="/dashboard/appointments" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link>} padded={false} className={showMoney ? "" : "xl:col-span-3"}>
          {todayAppts.length === 0 ? <div className="p-5"><Empty icon={CalendarDays} text={t("d_noAppts")} /></div> : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {todayAppts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="tabular w-12 text-sm font-semibold text-slate-900 dark:text-white">{time(a.starts_at)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{a.customer_name}</span>
                  <Badge tone={statusTone(a.status)}>{st(a.status)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>}
      </div>}

      {(showMoney || showInvoices) && (
        <div className="grid gap-6 xl:grid-cols-2">
          {showMoney && <Card title={t("d_recentTx")} action={<Link href="/dashboard/reports" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link>} padded={false}>
            {recentTx.length === 0 ? <div className="p-5"><Empty icon={ShoppingCart} text={t("d_noTx")} /></div> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTx.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <Badge>{t(`m_${x.method}` as DictKey)}</Badge>
                    <span className="flex-1 text-xs text-slate-500">{date(x.created_at)} · {t("d_commission")} {money(x.commission_cents)}</span>
                    <span className="tabular font-semibold">{money(x.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>}
          {showInvoices && <Card title={t("d_recentInv")} className={showMoney ? "" : "xl:col-span-2"} action={can("invoices:read") ? <Link href="/dashboard/invoices" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link> : undefined} padded={false}>
            {recentInv.length === 0 ? <div className="p-5"><Empty icon={Receipt} text={t("d_noInv")} /></div> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentInv.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="tabular font-medium">{i.number}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-500">{i.customer_name ?? "—"}</span>
                    <span className="tabular font-semibold">{money(i.total_cents)}</span>
                    <Badge tone={statusTone(i.status)}>{st(i.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>}
        </div>
      )}

      {/* Industry modules */}
      {p === "praxis" && (
        <Card title={t("d_queue")} action={<Link href="/dashboard/queue" className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">{t("viewAll")}</Link>}>
          {myTickets.length === 0 ? <Empty text={t("q_empty")} /> : <div className="flex flex-wrap gap-2">{myTickets.map((x) => <Badge key={x.id} tone={statusTone(x.status)}>#{x.number} {x.patient_name ?? ""} · {st(x.status)}</Badge>)}</div>}
        </Card>
      )}
      {p === "design" && (
        <Card title={t("d_projects")}>{myProjects.length === 0 ? <Empty text={t("noData")} /> : myProjects.map((x) => <p key={x.id} className="py-1.5 text-sm"><b>{x.name}</b> · {x.client_name} · {t("d_deadline")} {x.deadline ? date(x.deadline) : "—"} · {money(x.amount_cents ?? 0)}</p>)}</Card>
      )}
      {p === "kuenstler" && (
        <Card title={t("d_gigs")}>{myGigs.length === 0 ? <Empty text={t("noData")} /> : myGigs.map((g) => <p key={g.id} className="py-1.5 text-sm"><b>{g.title}</b> · {g.venue} · {date(g.gig_date)} · {money(g.fee_cents ?? 0)}</p>)}</Card>
      )}
      {p === "buchhandlung" && (
        <Card title={t("d_loans")}>{myLoans.length === 0 ? <Empty text={t("noData")} /> : myLoans.map((l) => <p key={l.id} className="py-1.5 text-sm"><b>{l.book_title}</b> · {l.member_name} · {t("d_due")} {date(l.due_at)}</p>)}</Card>
      )}
      {p === "schule" && (
        <Card title={t("d_classes")}>{myClasses.length === 0 ? <Empty text={t("noData")} /> : myClasses.map((c) => (
          <div key={c.id} className="py-1.5 text-sm"><b>{c.name}</b> · {c.teacher_name}
            <span className="ms-2 text-slate-500">{((c.schedule as { day: string; subject: string; time: string }[]) ?? []).map((s) => `${s.day} ${s.time} ${s.subject}`).join(" · ")}</span></div>
        ))}</Card>
      )}
      {p === "baeckerei" && (
        <Card title={t("d_recipes")}>{myRecipes.length === 0 ? <Empty text={t("noData")} /> : myRecipes.map((r) => <p key={r.id} className="py-1.5 text-sm"><b>{r.name}</b> · {r.flour_kg_per_loaf ?? 350} {t("d_flourPerLoaf")}</p>)}</Card>
      )}
      {(p === "apotheke" || p === "restaurant") && (
        <Card title={t("d_orders")}>{myOrders.length === 0 ? <Empty text={t("noData")} /> : myOrders.map((o) => (
          <p key={o.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm"><b>{o.customer_name}</b> · {o.source} · {money(o.total_cents)} <Badge tone={statusTone(o.status)}>{st(o.status)}</Badge>{o.requires_prescription && <Badge tone="amber">{t("d_prescription")}</Badge>}</p>
        ))}</Card>
      )}
    </div>
  );
}

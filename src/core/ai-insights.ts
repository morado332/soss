import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, products, invoice_items, invoices, appointments, transactions, tenants, fs_vehicles, fs_students, fs_lessons, biz_records } from "@/db/schema";
import type { Tenant } from "@/lib/guard";
import type { ModuleKey } from "@/modules/registry";

/**
 * AI advisor insights: rule-based analysis of the business's OWN data, delivered as notifications
 * (type "ai"). Text is stored as an i18n key + JSON variables so it shows in the reader's language.
 * Each situation has a dedupe key → the same insight is never sent twice.
 * Integration point: the same aggregates can be sent to Claude (ANTHROPIC_API_KEY) for richer advice.
 */
type Insight = { key: string; severity: "info" | "tip" | "warning" | "critical"; msg: string; vars?: Record<string, string | number> };

const week = (d = new Date()) => { const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - day); const y = new Date(Date.UTC(x.getUTCFullYear(), 0, 1)); return `${x.getUTCFullYear()}-W${Math.ceil(((+x - +y) / 86_400_000 + 1) / 7)}`; };
const month = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

async function collect(tenant: Tenant, mods: Set<ModuleKey>): Promise<Insight[]> {
  const tid = tenant.id;
  const out: Insight[] = [];
  const now = Date.now();
  const d7 = new Date(now - 7 * 86_400_000), d14 = new Date(now - 14 * 86_400_000);

  if (mods.has("products")) {
    // sales velocity per item name over the last 14 days
    const sold = await db.select({ name: invoice_items.name, qty: sql<number>`sum(${invoice_items.quantity})::int` })
      .from(invoice_items).innerJoin(invoices, eq(invoice_items.invoice_id, invoices.id))
      .where(and(eq(invoice_items.tenant_id, tid), gte(invoices.issued_at, d14), eq(invoices.type, "invoice"))).groupBy(invoice_items.name);
    const perDay = new Map(sold.map((s) => [s.name, s.qty / 14]));
    const prods = await db.select().from(products).where(and(eq(products.tenant_id, tid), eq(products.is_active, true)));
    for (const p of prods) {
      const v = perDay.get(p.name) ?? 0;
      if (p.stock <= 0) out.push({ key: `out:${p.id}:${week()}`, severity: "critical", msg: "ai_out_of_stock", vars: { name: p.name } });
      else if (v > 0 && p.stock / v <= 7) out.push({ key: `runout:${p.id}:${week()}`, severity: "warning", msg: "ai_runs_out", vars: { name: p.name, days: Math.max(1, Math.round(p.stock / v)), stock: p.stock } });
      else if (p.stock <= (p.low_stock_threshold ?? 5)) out.push({ key: `low:${p.id}:${week()}`, severity: "warning", msg: "ai_low_stock", vars: { name: p.name, stock: p.stock } });
    }
    const top = [...sold].sort((a, b) => b.qty - a.qty)[0];
    if (top && top.qty >= 3) out.push({ key: `best:${week()}`, severity: "tip", msg: "ai_best_seller", vars: { name: top.name, qty: top.qty } });
  }

  if (mods.has("pos")) {
    const sum = async (from: Date, to: Date) => (await db.select({ v: sql<number>`coalesce(sum(amount_cents),0)::int` }).from(transactions)
      .where(and(eq(transactions.tenant_id, tid), gte(transactions.created_at, from), lt(transactions.created_at, to))))[0].v;
    const cur = await sum(d7, new Date(now)), prev = await sum(d14, d7);
    if (prev > 5000) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      if (pct <= -20) out.push({ key: `drop:${week()}`, severity: "warning", msg: "ai_sales_drop", vars: { p: Math.abs(pct) } });
      if (pct >= 20) out.push({ key: `up:${week()}`, severity: "tip", msg: "ai_sales_up", vars: { p: pct } });
    }
  }

  if (mods.has("appointments") && !mods.has("fahrschule")) {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const tm = new Date(t0.getTime() + 86_400_000), tm2 = new Date(t0.getTime() + 2 * 86_400_000);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(appointments)
      .where(and(eq(appointments.tenant_id, tid), gte(appointments.starts_at, tm), lt(appointments.starts_at, tm2), sql`${appointments.status} in ('scheduled','confirmed')`));
    if (n > 0) out.push({ key: `tomorrow:${tm.toISOString().slice(0, 10)}`, severity: "info", msg: "ai_tomorrow", vars: { n } });
  }

  if (mods.has("invoices")) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(invoices)
      .where(and(eq(invoices.tenant_id, tid), eq(invoices.status, "issued"), eq(invoices.type, "invoice"), lt(invoices.issued_at, d14)));
    if (n > 0) out.push({ key: `unpaid:${week()}`, severity: "warning", msg: "ai_unpaid", vars: { n } });
  }

  if (mods.has("fahrschule")) {
    const soon = new Date(now + 14 * 86_400_000).toISOString().slice(0, 10);
    for (const v of await db.select().from(fs_vehicles).where(and(eq(fs_vehicles.tenant_id, tid), eq(fs_vehicles.is_active, true), sql`${fs_vehicles.next_service} <= ${soon}`)))
      out.push({ key: `service:${v.id}:${v.next_service}`, severity: "warning", msg: "ai_vehicle_service", vars: { name: `${v.name} (${v.plate})`, date: String(v.next_service) } });
    const done = (type: string) => sql<number>`coalesce((select sum(l.units) from fs_lessons l where l.student_id = "fs_students"."id" and l.tenant_id = ${tid} and l.status = 'completed' and l.type = ${type}),0)::int`;
    const studs = await db.select({
      id: fs_students.id, name: fs_students.name, theory: fs_students.theory_passed, practical: fs_students.practical_passed,
      rn: fs_students.req_normal, ru: fs_students.req_ueberland, ra: fs_students.req_autobahn, rx: fs_students.req_nacht,
      n: done("normal"), u: done("ueberland"), a: done("autobahn"), x: done("nacht"),
      unbilled: sql<number>`(select count(*)::int from fs_lessons l where l.student_id = "fs_students"."id" and l.tenant_id = ${tid} and l.status = 'completed' and l.invoice_id is null and l.price_cents > 0)`,
    }).from(fs_students).where(and(eq(fs_students.tenant_id, tid), eq(fs_students.status, "active")));
    for (const s of studs) {
      if (!s.practical && s.theory && s.n >= s.rn && s.u >= s.ru && s.a >= s.ra && s.x >= s.rx) out.push({ key: `exam:${s.id}`, severity: "tip", msg: "ai_ready_exam", vars: { name: s.name } });
      if (s.unbilled >= 5) out.push({ key: `unbilled:${s.id}:${week()}`, severity: "info", msg: "ai_unbilled", vars: { name: s.name, n: s.unbilled } });
    }
    void fs_lessons;
  }

  if (mods.has("expiry") || mods.has("batches")) {
    const soon = new Date(now + 30 * 86_400_000).toISOString().slice(0, 10), today = new Date(now).toISOString().slice(0, 10);
    const rows = await db.select({ id: biz_records.id, data: biz_records.data, product: products.name }).from(biz_records)
      .leftJoin(products, and(eq(products.tenant_id, tid), sql`${products.id}::text = ${biz_records.data}->>'product'`))
      .where(and(eq(biz_records.tenant_id, tid), eq(biz_records.kind, "batches"), sql`${biz_records.data}->>'expiry' <= ${soon}`)).limit(50);
    for (const r of rows) {
      const d = r.data as { expiry: string; batch_no: string; qty: number };
      if (d.expiry < today) out.push({ key: `expired:${r.id}`, severity: "critical", msg: "ai_expired", vars: { name: r.product ?? "?", batch: d.batch_no, qty: d.qty } });
      else out.push({ key: `expiring:${r.id}`, severity: "warning", msg: "ai_expiring", vars: { name: r.product ?? "?", batch: d.batch_no, date: d.expiry, qty: d.qty } });
    }
  }

  if (mods.has("ingredients")) {
    const rows = await db.select({ id: biz_records.id, data: biz_records.data }).from(biz_records)
      .where(and(eq(biz_records.tenant_id, tid), eq(biz_records.kind, "ingredients"), sql`(${biz_records.data}->>'qty')::numeric <= coalesce((${biz_records.data}->>'min_qty')::numeric, 0)`)).limit(30);
    for (const r of rows) { const d = r.data as { name: string; qty?: number; unit?: string }; out.push({ key: `ingr:${r.id}:${week()}`, severity: "warning", msg: "ai_ingredient_low", vars: { name: d.name, qty: d.qty ?? 0, unit: d.unit ?? "" } }); }
  }

  if (mods.has("debts")) {
    const [{ n, v }] = await db.select({ n: sql<number>`count(*)::int`, v: sql<number>`coalesce(sum(${invoices.total_cents}),0)::int` }).from(invoices)
      .where(and(eq(invoices.tenant_id, tid), eq(invoices.status, "issued"), eq(invoices.type, "invoice"), lt(invoices.issued_at, new Date(now - 60 * 86_400_000))));
    if (n > 0) out.push({ key: `aged:${week()}`, severity: "critical", msg: "ai_debts_aged", vars: { n, sum: (v / 100).toFixed(2) } });
  }

  if (mods.has("tasks")) {
    const today = new Date(now).toISOString().slice(0, 10);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(biz_records).where(and(eq(biz_records.tenant_id, tid), eq(biz_records.kind, "tasks"),
      sql`${biz_records.data}->>'status' <> 'done'`, sql`${biz_records.data}->>'due' < ${today}`));
    if (n > 0) out.push({ key: `tasks:${today}`, severity: "info", msg: "ai_tasks_overdue", vars: { n } });
  }

  // monthly seasonal advice by profession
  const m = new Date().getMonth();
  const season = m >= 5 && m <= 7 ? "summer" : m >= 10 || m <= 1 ? "winter" : m >= 2 && m <= 4 ? "spring" : "autumn";
  const alias: Record<string, string> = { supermarkt: "kiosk", cafe: "restaurant" };
  const p0 = alias[tenant.profession] ?? tenant.profession;
  const prof = ["apotheke", "kiosk", "restaurant", "bekleidung", "fahrschule", "friseur", "beauty", "baeckerei"].includes(p0) ? p0 : "generic";
  out.push({ key: `season:${month()}`, severity: "tip", msg: `ai_season_${prof}_${season}` });
  return out;
}

/** Generates new insights for one business (idempotent). */
export async function generateInsights(tenant: Tenant, mods: Set<ModuleKey>): Promise<number> {
  if (!mods.has("ai")) return 0;
  const list = await collect(tenant, mods);
  let created = 0;
  for (const i of list) {
    const r = await db.insert(notifications).values({
      tenant_id: tenant.id, type: "ai", severity: i.severity, dedupe_key: `ai:${i.key}`, title: i.msg, body: JSON.stringify(i.vars ?? {}),
    }).onConflictDoNothing().returning({ id: notifications.id });
    created += r.length;
  }
  return created;
}

/** At most once per hour per business — called while rendering its dashboard, and by the cron job. */
export async function maybeGenerateInsights(tenant: Tenant, mods: Set<ModuleKey>) {
  const settings = (tenant.settings as Record<string, unknown> | null) ?? {};
  const last = Number(settings.ai_insights_at ?? 0);
  if (Date.now() - last < 60 * 60_000) return;
  await db.update(tenants).set({ settings: { ...settings, ai_insights_at: Date.now() } }).where(eq(tenants.id, tenant.id));
  try { await generateInsights(tenant, mods); } catch (e) { console.error("[ai-insights]", e); }
}

export async function latestInsights(tenantId: string, limit = 30) {
  return db.select().from(notifications).where(and(eq(notifications.tenant_id, tenantId), eq(notifications.type, "ai"))).orderBy(desc(notifications.created_at)).limit(limit);
}

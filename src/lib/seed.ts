import { db } from "@/db";
import { users, tenants, products, services, appointments, invoices, invoice_items, transactions, features, tenant_features, accountant_links, notifications, projects, tasks, queue_tickets, orders, loans, gigs, recipes, school_classes } from "@/db/schema";
import { hashPassword } from "./auth";
import { PROFESSIONS } from "./professions";
import { count } from "drizzle-orm";

// Idempotent demo seed — creates Root + 3 tenant owners + accountant + sample data for all 14 professions.
export async function ensureSeed() {
  const [{ value }] = await db.select({ value: count() }).from(users);
  if (value > 0) return;

  const pw = await hashPassword("Owner123!");
  const rootPw = await hashPassword("Root123!");
  const accPw = await hashPassword("Account123!");

  const [root] = await db.insert(users).values({
    email: "root@platform.de", password_hash: rootPw, name: "Platform Root", role: "root", permissions: ["*"],
  }).returning();

  const [acc] = await db.insert(users).values({
    email: "accountant@kanzlei.de", password_hash: accPw, name: "Steuerkanzlei Müller", role: "accountant", accountant_id: "ACC-1001", permissions: ["invoices:read", "export:datev"],
  }).returning();

  // One tenant per profession (14)
  const tenantRows: Record<string, string> = {};
  for (const p of PROFESSIONS) {
    const [t] = await db.insert(tenants).values({
      name: `${p.nameDe} Demo GmbH`, slug: p.key, profession: p.key, status: "active", plan: "pro",
      monthly_fee_cents: p.monthlyFee * 100, commission_percent: 500, commission_fixed_cents: 30, tax_rate_bp: p.key === "kiosk" || p.key === "buchhandlung" ? 700 : 1900,
      ust_idnr: "DE123456789", steuernummer: "12/345/67890", terminal_id: `TERM-${p.key.toUpperCase()}-01`, tse_serial: `TSE-${p.key.toUpperCase()}-001`,
    }).returning();
    tenantRows[p.key] = t.id;
    await db.insert(tenant_features).values([
      { tenant_id: t.id, feature_key: "appointments", enabled: true },
      { tenant_id: t.id, feature_key: "pos", enabled: true },
      { tenant_id: t.id, feature_key: "invoices", enabled: true },
      { tenant_id: t.id, feature_key: "accountant", enabled: true },
      { tenant_id: t.id, feature_key: "ai", enabled: true },
    ]);
    await db.insert(accountant_links).values({ accountant_user_id: acc.id, tenant_id: t.id });
  }

  await db.insert(features).values([
    { key: "appointments", name: "Termine & Buchung", is_enabled: true },
    { key: "pos", name: "Kasse (POS)", is_enabled: true },
    { key: "terminal", name: "Kartenterminal", is_enabled: true },
    { key: "ai", name: "KI-Berater", is_enabled: true },
    { key: "tse", name: "TSE / Fiskaly", is_enabled: true },
    { key: "datev", name: "DATEV-Export", is_enabled: true },
    { key: "xrechnung", name: "XRechnung / ZUGFeRD", is_enabled: true },
  ]);

  // Owners for 3 flagship tenants
  const owners: [string, string, string][] = [
    ["owner@fahrschule.de", "Fahrschule Inhaber", "fahrschule"],
    ["owner@friseur.de", "Salon Inhaber", "friseur"],
    ["owner@kiosk.de", "Kiosk Inhaber", "kiosk"],
  ];
  for (const [email, name, key] of owners) {
    await db.insert(users).values({ email, password_hash: pw, name, role: "tenant_owner", tenant_id: tenantRows[key], permissions: ["*"] });
  }
  // Staff demo
  await db.insert(users).values({ email: "staff@friseur.de", password_hash: pw, name: "Anna (Kasse)", role: "tenant_staff", tenant_id: tenantRows["friseur"], permissions: ["pos:use", "appointments:read"] });
  await db.insert(users).values({ email: "staff@fahrschule.de", password_hash: pw, name: "Trainer Max", role: "tenant_staff", tenant_id: tenantRows["fahrschule"], permissions: ["appointments:read", "appointments:write"] });

  // Sample data per flagship tenant
  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000);

  for (const key of ["fahrschule", "friseur", "kiosk"]) {
    const tid = tenantRows[key];
    await db.insert(products).values([
      { tenant_id: tid, name: key === "kiosk" ? "Cola 0,5L" : key === "friseur" ? "Haarschnitt" : "Fahrstunde 45min", barcode: "4001234567890", price_cents: key === "kiosk" ? 150 : 4500, stock: key === "kiosk" ? 3 : 99, low_stock_threshold: 10, category: "General" },
      { tenant_id: tid, name: key === "kiosk" ? "Brötchen" : key === "friseur" ? "Färbung" : "Theorie-Kurs", barcode: "4001234567891", price_cents: key === "kiosk" ? 80 : 6500, stock: 120, category: "General" },
      { tenant_id: tid, name: key === "kiosk" ? "Schokoriegel" : "Premium Service", barcode: "4001234567892", price_cents: key === "kiosk" ? 120 : 8900, stock: 45, category: "General" },
    ]);
    const [svc] = await db.insert(services).values({ tenant_id: tid, name: key === "friseur" ? "Haarschnitt + Styling" : key === "fahrschule" ? "Praktische Fahrstunde" : "Beratung", duration_minutes: 45, price_cents: 4500 }).returning();
    await db.insert(appointments).values([
      { tenant_id: tid, customer_name: "Lena Schmidt", customer_email: "lena@example.de", service_id: svc.id, starts_at: inDays(0), ends_at: inDays(0), status: "scheduled", source: "public_link" },
      { tenant_id: tid, customer_name: "Jonas Weber", customer_email: "jonas@example.de", service_id: svc.id, starts_at: inDays(1), ends_at: inDays(1), status: "confirmed", source: "dashboard" },
      { tenant_id: tid, customer_name: "Mia Fischer", service_id: svc.id, starts_at: inDays(2), ends_at: inDays(2), status: "scheduled", source: "public_link" },
    ]);
    // Invoices + transactions (for reports / AI / accountant)
    for (let i = 0; i < 6; i++) {
      const gross = 4500 + i * 700;
      const tax = Math.round((gross * 1900) / 11900);
      const commission = Math.round(gross * 0.05) + 30;
      const [inv] = await db.insert(invoices).values({
        tenant_id: tid, number: `2026-${String(i + 1).padStart(4, "0")}`, subtotal_cents: gross - tax, tax_cents: tax, total_cents: gross,
        customer_name: ["Lena Schmidt", "Jonas Weber", "Mia Fischer", "Tim Braun", "Sara Klein", "Paul Wolf"][i],
        tse_reference: `FISKALY-SIG-${i + 1}-DEMO`, issued_at: inDays(-i * 3),
      }).returning();
      await db.insert(invoice_items).values({ invoice_id: inv.id, tenant_id: tid, name: "Service / Produkt", quantity: 1, unit_price_cents: gross - tax, total_cents: gross - tax });
      await db.insert(transactions).values({
        tenant_id: tid, invoice_id: inv.id, amount_cents: gross, tax_cents: tax, commission_cents: commission, net_cents: gross - tax - commission,
        method: i % 3 === 0 ? "cash" : i % 3 === 1 ? "terminal" : "online",
        commission_snapshot: { percentBp: 500, fixedCents: 30, taxRateBp: 1900, source: "tenant" },
        created_at: inDays(-i * 3),
      });
    }
    await db.insert(notifications).values({ tenant_id: tid, title: "Neue Buchung", body: "Lena Schmidt hat online gebucht.", type: "booking" });
  }

  // Profession-specific samples
  await db.insert(projects).values({ tenant_id: tenantRows["design"], name: "Logo Relaunch — Café Berlin", client_name: "Café Berlin", deadline: inDays(5), status: "open", amount_cents: 450000 });
  await db.insert(tasks).values({ tenant_id: tenantRows["design"], title: "Entwurf v2 an Kunden senden", status: "todo", due_at: inDays(2) });
  await db.insert(queue_tickets).values([
    { tenant_id: tenantRows["praxis"], number: 1, status: "called", patient_name: "Herr Braun" },
    { tenant_id: tenantRows["praxis"], number: 2, status: "waiting", patient_name: "Frau Klein" },
    { tenant_id: tenantRows["praxis"], number: 3, status: "waiting", patient_name: "Herr Wolf" },
  ]);
  await db.insert(orders).values({ tenant_id: tenantRows["apotheke"], customer_name: "Anna Müller", items: [{ name: "Ibuprofen 400", qty: 1 }], total_cents: 899, status: "new", source: "online", requires_prescription: false });
  await db.insert(orders).values({ tenant_id: tenantRows["restaurant"], customer_name: "Lieferando #4821", items: [{ name: "Schnitzel", qty: 2 }], total_cents: 2890, status: "new", source: "lieferando" });
  await db.insert(loans).values({ tenant_id: tenantRows["buchhandlung"], member_name: "Max Mustermann", book_title: "Der kleine Prinz", due_at: inDays(-2) });
  await db.insert(gigs).values({ tenant_id: tenantRows["kuenstler"], title: "Sommerfest Live", venue: "Stadthalle Berlin", gig_date: inDays(10), fee_cents: 120000, deposit_cents: 30000, status: "booked" });
  await db.insert(recipes).values({ tenant_id: tenantRows["baeckerei"], name: "Weizenbrot 500g", flour_kg_per_loaf: 350 });
  await db.insert(school_classes).values({ tenant_id: tenantRows["schule"], name: "5a", teacher_name: "Frau Schmidt", schedule: [{ day: "Mo", subject: "Mathe", time: "08:00" }], homework: [{ subject: "Mathe", text: "S. 42 Nr. 1-5" }] });
  await db.insert(products).values({ tenant_id: tenantRows["bekleidung"], name: "T-Shirt", barcode: "4009998887776", price_cents: 1999, stock: 20, variants: [{ size: "M", color: "Schwarz", stock: 8, barcode: "4009998887776" }, { size: "L", color: "Weiß", stock: 12, barcode: "4009998887777" }] });
  void root;
}

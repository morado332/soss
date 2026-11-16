import "server-only";
import { db } from "@/db";
import { users, tenants, products, services, appointments, invoices, invoice_items, transactions, features, accountant_links, fs_instructors, fs_vehicles, fs_students, fs_lessons, notifications, projects, tasks, queue_tickets, orders, loans, gigs, recipes, school_classes, subscriptions, platform_settings } from "@/db/schema";
import { hashPassword } from "./auth";
import { nextInvoiceNumber } from "./guard";
import { PROFESSIONS } from "./professions";
import { calcSplit } from "./commission";
import { STAFF_PRESETS } from "./permissions";

export const DEMO_PASSWORD = "Demo12345!";

const SAMPLE: Record<string, { products: [string, number, number, string][]; service?: [string, number, number] }> = {
  kiosk: { products: [["Cola 0,5 L", 150, 4, "4001234567890"], ["Brötchen", 80, 120, "4001234567891"], ["Schokoriegel", 120, 45, "4001234567892"], ["Mineralwasser 1 L", 99, 60, "4001234567893"], ["Tageszeitung", 250, 18, "4001234567894"], ["Kaffee to go", 220, 200, "4001234567895"]] },
  friseur: { products: [["Shampoo Repair", 1490, 12, "4002000000001"], ["Haarwachs", 990, 3, "4002000000002"], ["Pflegespülung", 1290, 9, "4002000000003"]], service: ["Haarschnitt & Styling", 45, 4500] },
  restaurant: { products: [["Schnitzel Wiener Art", 1450, 999, "4004000000001"], ["Apfelschorle 0,4 L", 390, 80, "4004000000002"], ["Tagessuppe", 590, 40, "4004000000003"]] },
  beauty: { products: [["Nagellack", 890, 30, "4005000000001"]], service: ["Maniküre", 60, 3500] },
  praxis: { products: [["Privatleistung Beratung", 4000, 999, "4006000000001"]], service: ["Kontrolltermin", 20, 0] },
  bekleidung: { products: [["T-Shirt Basic", 1999, 20, "4009998887776"], ["Jeans Slim", 5990, 8, "4009998887777"], ["Kapuzenpullover", 4490, 2, "4009998887778"]] },
  baeckerei: { products: [["Weizenbrot 500 g", 320, 40, "4007000000001"], ["Croissant", 140, 60, "4007000000002"], ["Laugenbrezel", 95, 80, "4007000000003"]] },
};

/** Creates demo businesses & users. Only called explicitly from the first-run setup when the admin opts in. */
export async function seedDemo() {
  const pw = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();
  const day = 86_400_000;

  await db.transaction(async (tx) => {
    const [acc] = await tx.insert(users).values({
      email: "accountant@kanzlei.de", password_hash: pw, name: "Steuerkanzlei Müller", role: "accountant", accountant_id: "ACC-1001", permissions: ["invoices:read"],
    }).returning();

    await tx.insert(features).values([
      { key: "appointments", name: "Termine & Buchung" }, { key: "pos", name: "Kasse (POS)" }, { key: "terminal", name: "Kartenterminal" },
      { key: "ai", name: "KI-Berater" }, { key: "tse", name: "TSE / Fiskaly" }, { key: "datev", name: "DATEV-Export" }, { key: "xrechnung", name: "XRechnung / ZUGFeRD" },
    ]).onConflictDoNothing();

    for (const p of PROFESSIONS) {
      const taxRate = p.key === "kiosk" || p.key === "buchhandlung" || p.key === "baeckerei" ? 700 : 1900;
      const [t] = await tx.insert(tenants).values({
        name: `${p.nameDe} Demo`, slug: p.key, profession: p.key, status: "active", plan: "pro",
        monthly_fee_cents: p.monthlyFee * 100, commission_percent: 500, commission_fixed_cents: 30, tax_rate_bp: taxRate,
        ust_idnr: "DE123456789", steuernummer: "12/345/67890", terminal_id: `TERM-${p.key.toUpperCase()}-01`, tse_serial: `TSE-${p.key.toUpperCase()}-001`,
      }).returning();
      await tx.insert(subscriptions).values({ tenant_id: t.id, plan: "pro", status: "active", monthly_fee_cents: p.monthlyFee * 100 });
      await tx.insert(users).values({ email: `owner@${p.key}.de`, password_hash: pw, name: `${p.nameDe} Inhaber`, role: "tenant_owner", tenant_id: t.id, permissions: ["*"] });
      if (["friseur", "kiosk", "fahrschule"].includes(p.key)) await tx.insert(accountant_links).values({ accountant_user_id: acc.id, tenant_id: t.id });

      const sample = SAMPLE[p.key];
      if (!sample) continue;
      const prods = await tx.insert(products).values(sample.products.map(([name, price, stock, barcode]) => ({
        tenant_id: t.id, name, price_cents: price, stock, barcode, low_stock_threshold: 5, category: "Allgemein",
      }))).returning();
      if (sample.service) {
        const [svcName, dur, price] = sample.service;
        const [svc] = await tx.insert(services).values({ tenant_id: t.id, name: svcName, duration_minutes: dur, price_cents: price }).returning();
        const base = new Date(); base.setHours(9, 0, 0, 0);
        const mk = (dayOffset: number, hour: number, name: string, status: "scheduled" | "confirmed" | "completed", source: string) => {
          const s = new Date(base.getTime() + dayOffset * day); s.setHours(hour);
          return { tenant_id: t.id, customer_name: name, customer_email: `${name.split(" ")[0].toLowerCase()}@example.de`, service_id: svc.id, starts_at: s, ends_at: new Date(s.getTime() + dur * 60000), status, source };
        };
        await tx.insert(appointments).values([
          mk(0, 10, "Lena Schmidt", "confirmed", "public_link"), mk(0, 14, "Jonas Weber", "scheduled", "dashboard"),
          mk(1, 11, "Mia Fischer", "scheduled", "public_link"), mk(2, 16, "Tim Braun", "confirmed", "dashboard"), mk(-1, 12, "Sara Klein", "completed", "dashboard"),
        ]);
      }
      // ~40 days of sales history for reports & AI insights
      const names = ["Lena Schmidt", "Jonas Weber", "Mia Fischer", "Tim Braun", "Sara Klein", "Paul Wolf", "Barverkauf"];
      for (let i = 0; i < 24; i++) {
        const prod = prods[i % prods.length];
        const qty = 1 + (i % 3);
        const gross = prod.price_cents * qty;
        const split = calcSplit({ grossCents: gross, percentBp: 500, fixedCents: 30, taxRateBp: taxRate });
        const when = new Date(now - Math.floor(i * 1.7) * day - (i % 5) * 3_600_000);
        const method = (["cash", "terminal", "online"] as const)[i % 3];
        const number = await nextInvoiceNumber(tx, t.id);
        const [inv] = await tx.insert(invoices).values({
          tenant_id: t.id, number, status: "paid", customer_name: names[i % names.length], subtotal_cents: gross - split.taxCents, tax_cents: split.taxCents,
          total_cents: gross, tax_rate_bp: taxRate, tse_reference: method === "cash" ? `TSE-DEMO-${t.tse_serial}-${i + 1}` : null, issued_at: when, created_at: when,
        }).returning();
        await tx.insert(invoice_items).values({ invoice_id: inv.id, tenant_id: t.id, name: prod.name, quantity: qty, unit_price_cents: prod.price_cents, total_cents: gross });
        await tx.insert(transactions).values({
          tenant_id: t.id, invoice_id: inv.id, amount_cents: gross, tax_cents: split.taxCents, commission_cents: split.commissionCents, net_cents: split.netCents, method,
          commission_snapshot: { percentBp: 500, fixedCents: 30, taxRateBp: taxRate, source: "tenant", grossCents: gross }, created_at: when,
        });
      }
      await tx.insert(notifications).values({ tenant_id: t.id, title: "Neue Online-Buchung", body: "Lena Schmidt hat einen Termin gebucht.", type: "booking" });
    }

    const all = await tx.select({ id: tenants.id, slug: tenants.slug }).from(tenants);
    const T = Object.fromEntries(all.map((r) => [r.slug, r.id]));

    // ---- driving school module demo data
    {
      const tid = T.fahrschule;
      const ins = await tx.insert(fs_instructors).values([
        { tenant_id: tid, name: "Max Becker", email: "max@fahrschule-demo.de", license_classes: "B, BE" },
        { tenant_id: tid, name: "Julia Wagner", email: "julia@fahrschule-demo.de", license_classes: "B, A" },
      ]).returning();
      const veh = await tx.insert(fs_vehicles).values([
        { tenant_id: tid, name: "VW Golf 8", plate: "B-FS 101", transmission: "manual", next_service: new Date(now + 9 * day).toISOString().slice(0, 10) },
        { tenant_id: tid, name: "Toyota Yaris Hybrid", plate: "B-FS 202", transmission: "automatic", next_service: new Date(now + 60 * day).toISOString().slice(0, 10) },
      ]).returning();
      const stu = await tx.insert(fs_students).values([
        { tenant_id: tid, name: "Lena Schmidt", email: "lena@example.de", instructor_id: ins[0].id, theory_progress: 92, theory_passed: true, theory_external_id: "LS-1001" },
        { tenant_id: tid, name: "Jonas Weber", email: "jonas@example.de", instructor_id: ins[0].id, theory_progress: 64, theory_external_id: "JW-1002" },
        { tenant_id: tid, name: "Mia Fischer", email: "mia@example.de", instructor_id: ins[1].id, theory_progress: 35 },
        { tenant_id: tid, name: "Tim Braun", email: "tim@example.de", instructor_id: ins[1].id, theory_progress: 100, theory_passed: true, practical_passed: true, status: "finished" },
      ]).returning();
      const at = (dOff: number, h: number) => { const x = new Date(now + dOff * day); x.setHours(h, 0, 0, 0); return x; };
      const lesson = (s: number, i: number, v: number | null, type: string, dOff: number, h: number, units: number, status: string) => ({
        tenant_id: tid, student_id: stu[s].id, instructor_id: ins[i].id, vehicle_id: v === null ? null : veh[v].id, type,
        starts_at: at(dOff, h), ends_at: new Date(at(dOff, h).getTime() + units * 45 * 60_000), units, status, price_cents: type === "normal" ? 5900 * units : 7900 * units,
      });
      const past = [];
      for (let k = 0; k < 14; k++) past.push(lesson(0, 0, 0, "normal", -40 + k * 2, 9 + (k % 3) * 2, 1, "completed"));
      past.push(lesson(0, 0, 0, "ueberland", -12, 14, 2, "completed"), lesson(0, 0, 0, "ueberland", -10, 14, 2, "completed"), lesson(0, 0, 0, "autobahn", -8, 10, 2, "completed"), lesson(0, 0, 0, "nacht", -6, 19, 2, "completed"));
      for (let k = 0; k < 8; k++) past.push(lesson(1, 0, 1, "normal", -20 + k * 2, 15, 1, "completed"));
      for (let k = 0; k < 3; k++) past.push(lesson(2, 1, 1, "normal", -6 + k * 2, 11, 1, "completed"));
      await tx.insert(fs_lessons).values([
        ...past,
        lesson(0, 0, 0, "autobahn", 0, 10, 2, "scheduled"), lesson(1, 0, 1, "normal", 0, 15, 1, "scheduled"),
        lesson(2, 1, 1, "normal", 1, 9, 2, "scheduled"), lesson(1, 0, 0, "ueberland", 2, 13, 2, "scheduled"), lesson(0, 1, 0, "nacht", 3, 19, 2, "scheduled"),
      ]);
    }

    await tx.insert(users).values({ email: "staff@friseur.de", password_hash: pw, name: "Anna (Kasse)", role: "tenant_staff", tenant_id: T.friseur, permissions: STAFF_PRESETS.cashier });
    await tx.insert(projects).values({ tenant_id: T.design, name: "Logo-Relaunch Café Berlin", client_name: "Café Berlin", deadline: new Date(now + 5 * day), status: "open", amount_cents: 450000 });
    await tx.insert(tasks).values({ tenant_id: T.design, title: "Entwurf v2 an Kunden senden", status: "todo", due_at: new Date(now + 2 * day) });
    await tx.insert(queue_tickets).values([
      { tenant_id: T.praxis, number: 1, status: "called", patient_name: "Herr Braun" },
      { tenant_id: T.praxis, number: 2, status: "waiting", patient_name: "Frau Klein" },
      { tenant_id: T.praxis, number: 3, status: "waiting", patient_name: "Herr Wolf" },
    ]);
    await tx.insert(orders).values([
      { tenant_id: T.apotheke, customer_name: "Anna Müller", items: [{ name: "Ibuprofen 400", qty: 1 }], total_cents: 899, status: "new", source: "online" },
      { tenant_id: T.restaurant, customer_name: "Lieferando #4821", items: [{ name: "Schnitzel", qty: 2 }], total_cents: 2890, status: "new", source: "lieferando" },
    ]);
    await tx.insert(loans).values({ tenant_id: T.buchhandlung, member_name: "Max Mustermann", book_title: "Der kleine Prinz", due_at: new Date(now - 2 * day) });
    await tx.insert(gigs).values({ tenant_id: T.kuenstler, title: "Sommerfest Live", venue: "Stadthalle Berlin", gig_date: new Date(now + 10 * day), fee_cents: 120000, deposit_cents: 30000, status: "booked" });
    await tx.insert(recipes).values({ tenant_id: T.baeckerei, name: "Weizenbrot 500 g", flour_kg_per_loaf: 350 });
    await tx.insert(school_classes).values({ tenant_id: T.schule, name: "5a", teacher_name: "Frau Schmidt", schedule: [{ day: "Mo", subject: "Mathe", time: "08:00" }, { day: "Di", subject: "Deutsch", time: "09:45" }], homework: [{ subject: "Mathe", text: "S. 42 Nr. 1–5" }] });
    await tx.insert(platform_settings).values({ key: "demo_seeded", value: true }).onConflictDoUpdate({ target: platform_settings.key, set: { value: true } });
  });
}

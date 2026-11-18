import "server-only";
import { db } from "@/db";
import { and, eq, like } from "drizzle-orm";
import { users, tenants, products, services, appointments, invoices, invoice_items, transactions, features, accountant_links, fs_instructors, fs_vehicles, fs_students, fs_lessons, notifications, projects, tasks, queue_tickets, orders, loans, gigs, recipes, school_classes, subscriptions, platform_settings, profiles, biz_records } from "@/db/schema";
import { hashPassword } from "./auth";
import { nextInvoiceNumber } from "./guard";
import { PROFESSIONS } from "./professions";
import { calcSplit } from "./commission";
import { STAFF_PRESETS } from "./permissions";

export const DEMO_PASSWORD = "Demo12345!";

const SAMPLE: Record<string, { products: [string, number, number, string][]; service?: [string, number, number] }> = {
  kiosk: { products: [["Cola 0,5 L", 150, 4, "4001234567890"], ["Brötchen", 80, 120, "4001234567891"], ["Schokoriegel", 120, 45, "4001234567892"], ["Mineralwasser 1 L", 99, 60, "4001234567893"], ["Tageszeitung", 250, 18, "4001234567894"], ["Kaffee to go", 220, 200, "4001234567895"]] },
  friseur: { products: [["Shampoo Repair", 1490, 12, "4002000000001"], ["Haarwachs", 990, 3, "4002000000002"], ["Pflegespülung", 1290, 9, "4002000000003"]], service: ["Haarschnitt & Styling", 45, 4500] },
  beauty: { products: [["Nagellack", 890, 30, "4005000000001"]], service: ["Maniküre", 60, 3500] },
  praxis: { products: [["Privatleistung Beratung", 4000, 999, "4006000000001"]], service: ["Kontrolltermin", 20, 0] },
  bekleidung: { products: [["T-Shirt Basic", 1999, 20, "4009998887776"], ["Jeans Slim", 5990, 8, "4009998887777"], ["Kapuzenpullover", 4490, 2, "4009998887778"]] },
  apotheke: { products: [["Ibuprofen 400 mg, 20 St.", 599, 40, "4008000000001"], ["Paracetamol 500 mg, 20 St.", 349, 55, "4008000000002"], ["Nasenspray 15 ml", 499, 25, "4008000000003"], ["Amoxicillin 1000 mg (Rx)", 1250, 12, "4008000000004"], ["Vitamin D3 1000 I.E.", 899, 3, "4008000000005"], ["Sonnencreme LSF 50", 1499, 18, "4008000000006"]] },
  supermarkt: { products: [["Milch 1 L", 119, 48, "4011000000001"], ["Eier 10 St.", 299, 30, "4011000000002"], ["Toastbrot", 149, 4, "4011000000003"], ["Bananen 1 kg", 179, 25, "4011000000004"], ["Joghurt 500 g", 89, 36, ""], ["Kaffee 500 g", 649, 14, ""]] },
  cafe: { products: [["Cappuccino", 320, 999, ""], ["Latte Macchiato", 360, 999, ""], ["Croissant", 220, 30, ""], ["Käsekuchen", 390, 12, ""], ["Frischer O-Saft", 420, 40, ""]] },
  restaurant: { products: [["Schnitzel Wiener Art", 1450, 999, "4004000000001"], ["Apfelschorle 0,4 L", 390, 80, "4004000000002"], ["Tagessuppe", 590, 40, "4004000000003"], ["Pizza Margherita", 990, 999, ""], ["Tiramisu", 590, 20, ""]] },
  haendler: { products: [["Tomaten (kg)", 180, 400, ""], ["Kartoffeln (kg)", 90, 1200, ""], ["Zwiebeln (kg)", 70, 800, ""]] },
  bau: { products: [["Zement 25 kg", 690, 120, ""], ["Bewehrungsstahl (t)", 85000, 6, ""], ["Ziegel (Palette)", 32000, 18, ""]] },
  allgemein: { products: [["Beratungsstunde", 9500, 999, ""], ["Wartungspaket", 24900, 999, ""]] },
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
        tenant_id: t.id, name, price_cents: price, cost_cents: Math.round(price * 0.6), stock, barcode: barcode || null, low_stock_threshold: 5, category: "Allgemein",
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

    // pharmacy: reservable medicines (one prescription-only), 1,50 € reservation fee, public profiles
    await tx.update(products).set({ reservable: true }).where(eq(products.tenant_id, T.apotheke));
    await tx.update(products).set({ rx_required: true }).where(and(eq(products.tenant_id, T.apotheke), like(products.name, "%(Rx)%")));
    await tx.update(tenants).set({ settings: { pharmacy_fee_cents: 150, pharmacy_hold_hours: 48 } }).where(eq(tenants.id, T.apotheke));
    for (const [key, theme, headline] of [["apotheke", "green", "Ihre Apotheke um die Ecke · Berlin"], ["fahrschule", "glass", "Führerschein B, BE & A · Berlin"], ["friseur", "purple", "Haare mit Stil · Termine online"]] as const) {
      const [o] = await tx.select({ id: users.id, name: users.name }).from(users).where(eq(users.email, `owner@${key}.de`)).limit(1);
      if (o) await tx.insert(profiles).values({ user_id: o.id, tenant_id: T[key], slug: `${key}-demo`, display_name: o.name, headline, theme, published: true, show_booking: key !== "apotheke", show_pharmacy: key === "apotheke",
        phone: "+49 30 1234567", address: "Musterstraße 1, 10115 Berlin", links: [{ kind: "instagram", label: "Instagram", url: "https://instagram.com" }] });
    }
    // business records for the new modules (customers, suppliers, tables, patients, properties, projects, …)
    const rec = (tenant: string | undefined, kind: string, data: Record<string, unknown>[]) => tenant ? tx.insert(biz_records).values(data.map((d) => ({ tenant_id: tenant, kind, data: d, search: Object.values(d).filter((v) => typeof v === "string").join(" ").toLowerCase() }))) : Promise.resolve();
    const iso = (offset: number) => new Date(now + offset * day).toISOString().slice(0, 10);
    for (const k of ["restaurant", "cafe", "supermarkt", "apotheke", "bekleidung", "haendler", "bau", "allgemein"]) {
      await rec(T[k], "customers", [{ name: "Müller GmbH", phone: "+49 30 555 0101", email: "einkauf@mueller.de", credit_limit: 500000 }, { name: "Familie Schneider", phone: "+49 170 2223344" }]);
      await rec(T[k], "suppliers", [{ name: "Metro Großhandel", contact: "Herr Klein", phone: "+49 30 999 100", payment_terms: 14 }, { name: "Regional-Frisch eG", contact: "Frau Yilmaz", payment_terms: 30 }]);
      await rec(T[k], "expenses", [{ type: "expense", description: "Ladenmiete", category: "rent", amount: 180000, date: iso(-12), method: "transfer" }, { type: "expense", description: "Strom & Wasser", category: "utilities", amount: 32000, date: iso(-5), method: "transfer" }]);
      await rec(T[k], "tasks", [{ title: "Inventur vorbereiten", priority: "high", status: "todo", due: iso(2) }, { title: "Lieferantenrechnung prüfen", priority: "normal", status: "doing", due: iso(-1) }]);
    }
    for (const k of ["restaurant", "cafe"]) {
      await rec(T[k], "tables", [1, 2, 3, 4, 5, 6].map((n) => ({ name: `Tisch ${n}`, seats: n % 3 === 0 ? 6 : 4, area: n > 4 ? "terrace" : "indoor", status: n === 2 ? "occupied" : "free" })));
      await rec(T[k], "menu_sections", [{ name: "Vorspeisen", sort: 1, active: true }, { name: "Hauptgerichte", sort: 2, active: true }, { name: "Desserts", sort: 3, active: true }, { name: "Getränke", sort: 4, active: true }]);
      await rec(T[k], "promotions", [{ name: "Happy Hour", code: "HAPPY", discount_type: "percent", value: 20, from: iso(-3), to: iso(30), active: true }]);
    }
    await rec(T.restaurant, "ingredients", [{ name: "Mehl", unit: "kg", qty: 4, min_qty: 10, unit_cost: 90 }, { name: "Tomaten", unit: "kg", qty: 18, min_qty: 5, unit_cost: 250 }, { name: "Olivenöl", unit: "l", qty: 6, min_qty: 3, unit_cost: 890 }]);
    await rec(T.apotheke, "drug_categories", [{ name: "Analgetika", code: "N02", rx: false, storage: "room" }, { name: "Antibiotika", code: "J01", rx: true, storage: "room" }, { name: "Impfstoffe", code: "J07", rx: true, storage: "cool" }]);
    for (const k of ["apotheke", "supermarkt"]) {
      const ps = T[k] ? await tx.select({ id: products.id }).from(products).where(eq(products.tenant_id, T[k])).limit(4) : [];
      await rec(T[k], "batches", ps.map((p, i) => ({ product: p.id, batch_no: `CH-${2400 + i}`, expiry: iso([-4, 12, 60, 400][i]), qty: [6, 20, 15, 40][i] })));
    }
    await rec(T.bekleidung, "categories", [{ name: "Jeans", type: "men", season: "all" }, { name: "Sommerkleider", type: "women", season: "summer" }, { name: "Kinderjacken", type: "kids", season: "winter" }]);
    await rec(T.bekleidung, "sales_reps", [{ name: "Lukas Hoffmann", phone: "+49 171 4455667", commission: 3, target: 2000000, area: "Berlin Nord" }]);
    await rec(T.bekleidung, "employees", [{ name: "Sophie Wagner", position: "Verkäuferin", start: iso(-400), active: true }, { name: "Ali Demir", position: "Filialleitung", start: iso(-900), active: true }]);
    if (T.bekleidung) {
      const [shirt] = await tx.select({ id: products.id }).from(products).where(and(eq(products.tenant_id, T.bekleidung), like(products.name, "T-Shirt%"))).limit(1);
      if (shirt) await tx.update(products).set({ variants: [{ size: "S", color: "Schwarz", color_code: "#111111", stock: 4 }, { size: "M", color: "Schwarz", color_code: "#111111", stock: 7 }, { size: "L", color: "Weiß", color_code: "#ffffff", stock: 0 }, { size: "M", color: "Blau", color_code: "#1d4ed8", stock: 9 }], stock: 20 }).where(eq(products.id, shirt.id));
    }
    if (T.praxis) {
      await rec(T.praxis, "clinic_services", [{ name: "Erstuntersuchung", code: "GOÄ 1", price: 4500, duration: 30 }, { name: "Blutabnahme", code: "GOÄ 250", price: 1200, duration: 10 }, { name: "Ultraschall Abdomen", code: "GOÄ 410", price: 6800, duration: 20 }]);
      const pats = await tx.insert(biz_records).values([["Helga Braun", "1958-04-12", "female", "+49 30 1112233"], ["Murat Kaya", "1985-11-02", "male", "+49 176 9988776"], ["Lea Fischer", "2001-07-21", "female", "+49 152 3344556"]]
        .map(([name, birth, gender, phone], i) => ({ tenant_id: T.praxis, kind: "patients", data: { no: i + 1, name, birth, gender, phone, insurance: i === 1 ? "pkv" : "gkv", allergies: i === 0 ? "Penicillin" : "" }, search: `${name} ${phone}`.toLowerCase() }))).returning({ id: biz_records.id });
      await tx.insert(biz_records).values([
        { tenant_id: T.praxis, kind: "prescriptions", data: { no: 1, patient: pats[0].id, date: iso(-2), diagnosis: "Hypertonie", medication: "Ramipril 5 mg 1-0-0" }, search: "hypertonie ramipril" },
        { tenant_id: T.praxis, kind: "lab_tests", data: { patient: pats[1].id, category: "lab", test: "Großes Blutbild", date: iso(-1), status: "done", result: "unauffällig" }, search: "großes blutbild unauffällig" },
        { tenant_id: T.praxis, kind: "lab_tests", data: { patient: pats[2].id, category: "xray", test: "Röntgen Thorax", date: iso(0), status: "requested" }, search: "röntgen thorax" },
        { tenant_id: T.praxis, kind: "closing_days", data: { from: iso(20), to: iso(27), reason: "Praxisurlaub" }, search: "praxisurlaub" },
      ]);
      await tx.insert(appointments).values([{ tenant_id: T.praxis, customer_name: "Murat Kaya", customer_phone: "+49 176 9988776", starts_at: new Date(now - 3 * day), ends_at: new Date(now - 3 * day + 1_800_000), status: "no_show", source: "dashboard" },
        { tenant_id: T.praxis, customer_name: "Murat Kaya", customer_phone: "+49 176 9988776", starts_at: new Date(now - 30 * day), ends_at: new Date(now - 30 * day + 1_800_000), status: "no_show", source: "dashboard" }]);
    }
    if (T.immobilien) {
      const sellers = await tx.insert(biz_records).values([{ tenant_id: T.immobilien, kind: "sellers", data: { name: "Erbengemeinschaft Weber", phone: "+49 30 7788990", asking: 49000000, commission: 3.57 }, search: "erbengemeinschaft weber" }]).returning({ id: biz_records.id });
      const props = await tx.insert(biz_records).values([
        { tenant_id: T.immobilien, kind: "properties", data: { title: "3-Zimmer-Altbau mit Balkon", ptype: "apartment", deal: "sale", location: "Berlin-Prenzlauer Berg", area: 86, rooms: 3, price: 52000000, seller: sellers[0].id, status: "available" }, search: "3-zimmer-altbau mit balkon berlin-prenzlauer berg" },
        { tenant_id: T.immobilien, kind: "properties", data: { title: "Ladenlokal Hauptstraße", ptype: "shop", deal: "rent", location: "Potsdam", area: 120, price: 240000, status: "reserved" }, search: "ladenlokal hauptstraße potsdam" },
      ]).returning({ id: biz_records.id });
      const buyers = await tx.insert(biz_records).values([{ tenant_id: T.immobilien, kind: "buyers", data: { name: "Dr. Anna Roth", phone: "+49 160 1234567", budget: 55000000, wanted: "3–4 Zimmer, Altbau, Berlin", stage: "viewing" }, search: "dr. anna roth 3–4 zimmer, altbau, berlin" }]).returning({ id: biz_records.id });
      await tx.insert(biz_records).values({ tenant_id: T.immobilien, kind: "viewings", data: { property: props[0].id, buyer: buyers[0].id, at: new Date(now + 2 * day).toISOString(), status: "planned" }, search: "" });
    }
    for (const k of ["bau", "allgemein"]) {
      if (!T[k]) continue;
      const [cust] = await tx.select({ id: biz_records.id }).from(biz_records).where(and(eq(biz_records.tenant_id, T[k]), eq(biz_records.kind, "customers"))).limit(1);
      const [proj] = await tx.insert(biz_records).values({ tenant_id: T[k], kind: "projects", data: { name: k === "bau" ? "Mehrfamilienhaus Lindenweg 4" : "Website-Relaunch Müller GmbH", client: cust?.id, budget: k === "bau" ? 120000000 : 1800000, start: iso(-60), end: iso(120), progress: 45, status: "active" }, search: "projekt" }).returning({ id: biz_records.id });
      await tx.insert(biz_records).values([
        { tenant_id: T[k], kind: "progress_bills", data: { no: 1, project: proj.id, date: iso(-30), progress: 25, amount: k === "bau" ? 30000000 : 450000, retention: 5, status: "paid" }, search: "ab-1" },
        { tenant_id: T[k], kind: "progress_bills", data: { no: 2, project: proj.id, date: iso(-2), progress: 45, amount: k === "bau" ? 24000000 : 360000, retention: 5, status: "submitted" }, search: "ab-2" },
      ]);
    }
    await rec(T.allgemein, "vouchers", [{ no: 1, type: "receipt", party: "Müller GmbH", amount: 450000, date: iso(-20), method: "transfer" }, { no: 2, type: "payment", party: "Büromiete", amount: 120000, date: iso(-10), method: "transfer" }]);
    await rec(T.haendler, "daily_prices", [{ item: "Tomaten", unit: "kg", buy_price: 120, sell_price: 180, date: iso(0) }, { item: "Kartoffeln", unit: "kg", buy_price: 55, sell_price: 90, date: iso(0) }]);

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

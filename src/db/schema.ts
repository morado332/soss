import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, pgEnum, uniqueIndex, index, primaryKey } from "drizzle-orm/pg-core";

// ============================================================
// Multi-Tenant SaaS Schema — Every tenant-owned table has tenant_id (NOT NULL)
// RLS policies in docs/sql/rls.sql enforce the same at DB level.
// Money is stored in CENTS (integer) to avoid float errors (GoBD-safe).
// ============================================================

export const userRoleEnum = pgEnum("user_role", ["root", "super_admin", "tenant_owner", "tenant_staff", "accountant", "end_customer"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["trial", "active", "past_due", "suspended", "cancelled"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "issued", "paid", "storno", "cancelled"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card", "terminal", "online", "sepa", "paypal", "klarna"]);
export const appointmentStatusEnum = pgEnum("appointment_status", ["scheduled", "confirmed", "completed", "cancelled", "no_show"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  profession: text("profession").notNull(), // fahrschule | friseur | kiosk | design | steuerbuero | bekleidung | praxis | apotheke | kuenstler | restaurant | beauty | buchhandlung | schule | baeckerei
  status: tenantStatusEnum("status").default("trial").notNull(),
  plan: text("plan").default("starter").notNull(), // starter | pro | business
  monthly_fee_cents: integer("monthly_fee_cents").default(2900).notNull(),
  // Commission defaults (tenant level) — overridable per project
  commission_percent: integer("commission_percent").default(500), // basis points: 500 = 5.00%
  commission_fixed_cents: integer("commission_fixed_cents").default(30),
  tax_rate_bp: integer("tax_rate_bp").default(1900), // 1900 = 19%, 700 = 7%
  ust_idnr: text("ust_idnr"),
  steuernummer: text("steuernummer"),
  iban: text("iban"),
  stripe_account_id: text("stripe_account_id"),
  terminal_id: text("terminal_id"),
  fiskaly_client_id: text("fiskaly_client_id"),
  tse_serial: text("tse_serial"),
  grace_days: integer("grace_days").default(7),
  settings: jsonb("settings").default({}),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  tenant_id: uuid("tenant_id").references(() => tenants.id),
  accountant_id: text("accountant_id").unique(), // e.g. ACC-1001 for accountants
  permissions: jsonb("permissions").default([]), // RBAC granular permissions
  is_active: boolean("is_active").default(true).notNull(),
  two_factor_enabled: boolean("two_factor_enabled").default(false).notNull(),
  impersonated_by: uuid("impersonated_by"),
  failed_login_count: integer("failed_login_count").default(0).notNull(),
  locked_until: timestamp("locked_until", { withTimezone: true }),
  password_changed_at: timestamp("password_changed_at", { withTimezone: true }),
  last_login_at: timestamp("last_login_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_users_tenant").on(t.tenant_id)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  token_hash: text("token_hash").notNull().unique(),
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
  ip: text("ip"),
  user_agent: text("user_agent"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_sessions_user").on(t.user_id)]);

export const features = pgTable("features", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  is_enabled: boolean("is_enabled").default(true).notNull(),
});

export const tenant_features = pgTable("tenant_features", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  feature_key: text("feature_key").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  plan: text("plan").notNull(),
  status: text("status").default("trial").notNull(),
  monthly_fee_cents: integer("monthly_fee_cents").notNull(),
  current_period_end: timestamp("current_period_end", { withTimezone: true }),
  stripe_subscription_id: text("stripe_subscription_id"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const commission_settings = pgTable("commission_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  scope: text("scope").notNull(), // platform | tenant | project
  tenant_id: uuid("tenant_id").references(() => tenants.id),
  project_id: uuid("project_id"),
  percent_bp: integer("percent_bp").notNull(),
  fixed_cents: integer("fixed_cents").default(0).notNull(),
  tax_rate_bp: integer("tax_rate_bp").default(1900).notNull(),
  created_by: uuid("created_by"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  sku: text("sku"),
  barcode: text("barcode"),
  category: text("category").default("General"),
  price_cents: integer("price_cents").notNull(),
  cost_cents: integer("cost_cents").default(0),
  stock: integer("stock").default(0).notNull(),
  low_stock_threshold: integer("low_stock_threshold").default(5),
  variants: jsonb("variants").default([]), // [{size, color, stock, barcode}]
  rx_required: boolean("rx_required").default(false).notNull(), // pharmacy: prescription needed (reserve only, no online payment)
  reservable: boolean("reservable").default(false).notNull(),    // pharmacy: can be reserved from the public profile
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_products_tenant").on(t.tenant_id)]);

export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  duration_minutes: integer("duration_minutes").default(30).notNull(),
  price_cents: integer("price_cents").notNull(),
  staff_id: uuid("staff_id").references(() => users.id),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  customer_name: text("customer_name").notNull(),
  customer_email: text("customer_email"),
  customer_phone: text("customer_phone"),
  service_id: uuid("service_id").references(() => services.id),
  staff_id: uuid("staff_id").references(() => users.id),
  starts_at: timestamp("starts_at", { withTimezone: true }).notNull(),
  ends_at: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  notes: text("notes"),
  source: text("source").default("dashboard"), // dashboard | public_link | pos
  reminded_24h_at: timestamp("reminded_24h_at", { withTimezone: true }),
  reminded_1h_at: timestamp("reminded_1h_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_appointments_tenant_time").on(t.tenant_id, t.starts_at)]);

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  number: text("number").notNull(), // sequential per tenant, e.g. 2026-0001
  type: text("type").default("invoice").notNull(), // invoice | storno | platform_fee
  status: invoiceStatusEnum("status").default("issued").notNull(),
  customer_name: text("customer_name"),
  customer_email: text("customer_email"),
  subtotal_cents: integer("subtotal_cents").notNull(),
  tax_cents: integer("tax_cents").notNull(),
  total_cents: integer("total_cents").notNull(),
  tax_rate_bp: integer("tax_rate_bp").default(1900).notNull(),
  storno_of_id: uuid("storno_of_id"),
  tse_reference: text("tse_reference"), // Fiskaly TSE signature
  xrechnung_xml: text("xrechnung_xml"),
  issued_at: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("uq_invoices_tenant_number").on(t.tenant_id, t.number)]);

// Gap-free, race-safe invoice numbering per tenant and year (GoBD)
export const invoice_counters = pgTable("invoice_counters", {
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  year: integer("year").notNull(),
  last_number: integer("last_number").default(0).notNull(),
}, (t) => [primaryKey({ columns: [t.tenant_id, t.year] })]);

// Platform-wide key/value settings (setup state, demo flag, ...)
export const platform_settings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const invoice_items = pgTable("invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoice_id: uuid("invoice_id").references(() => invoices.id).notNull(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  quantity: integer("quantity").default(1).notNull(),
  unit_price_cents: integer("unit_price_cents").notNull(),
  total_cents: integer("total_cents").notNull(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  invoice_id: uuid("invoice_id").references(() => invoices.id),
  project_id: uuid("project_id"),
  amount_cents: integer("amount_cents").notNull(),
  tax_cents: integer("tax_cents").notNull(),
  commission_cents: integer("commission_cents").notNull(),
  net_cents: integer("net_cents").notNull(),
  method: paymentMethodEnum("method").notNull(),
  status: text("status").default("completed").notNull(),
  commission_snapshot: jsonb("commission_snapshot").default({}), // frozen rates at time of sale
  stripe_payment_intent: text("stripe_payment_intent"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_transactions_tenant_created").on(t.tenant_id, t.created_at)]);

export const audit_logs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actor_id: uuid("actor_id").references(() => users.id),
  tenant_id: uuid("tenant_id").references(() => tenants.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entity_id: text("entity_id"),
  old_value: jsonb("old_value"),
  new_value: jsonb("new_value"),
  ip: text("ip"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_audit_created").on(t.created_at)]);

export const accountant_links = pgTable("accountant_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountant_user_id: uuid("accountant_user_id").references(() => users.id).notNull(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  status: text("status").default("active").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("uq_accountant_tenant").on(t.accountant_user_id, t.tenant_id)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id),
  user_id: uuid("user_id").references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type").default("info"), // info | booking | sale | reminder | ai
  severity: text("severity").default("info").notNull(), // info | tip | warning | critical (AI insights)
  dedupe_key: text("dedupe_key"), // AI insights: one notification per situation (e.g. "low_stock:<product>:<week>")
  is_read: boolean("is_read").default(false).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("uq_notifications_dedupe").on(t.tenant_id, t.dedupe_key)]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  client_name: text("client_name"),
  deadline: timestamp("deadline", { withTimezone: true }),
  status: text("status").default("open").notNull(),
  amount_cents: integer("amount_cents").default(0),
  commission_percent_bp: integer("commission_percent_bp"), // project override
  commission_fixed_cents: integer("commission_fixed_cents"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  project_id: uuid("project_id").references(() => projects.id),
  title: text("title").notNull(),
  status: text("status").default("todo").notNull(),
  due_at: timestamp("due_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const queue_tickets = pgTable("queue_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  number: integer("number").notNull(),
  status: text("status").default("waiting").notNull(), // waiting | called | done
  patient_name: text("patient_name"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  customer_name: text("customer_name"),
  customer_email: text("customer_email"),
  items: jsonb("items").default([]),
  total_cents: integer("total_cents").notNull(),
  status: text("status").default("new").notNull(),
  source: text("source").default("online"), // online | pos | lieferando | uber_eats | wolt
  requires_prescription: boolean("requires_prescription").default(false).notNull(),
  customer_phone: text("customer_phone"),
  reservation_fee_cents: integer("reservation_fee_cents").default(0).notNull(),
  payment_status: text("payment_status").default("none").notNull(), // none | pending | paid | failed
  stripe_session_id: text("stripe_session_id"),
  pickup_code: text("pickup_code"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const loans = pgTable("loans", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  member_name: text("member_name").notNull(),
  book_title: text("book_title").notNull(),
  loaned_at: timestamp("loaned_at", { withTimezone: true }).defaultNow().notNull(),
  due_at: timestamp("due_at", { withTimezone: true }).notNull(),
  returned_at: timestamp("returned_at", { withTimezone: true }),
  fine_cents: integer("fine_cents").default(0),
});

export const gigs = pgTable("gigs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  title: text("title").notNull(),
  venue: text("venue"),
  gig_date: timestamp("gig_date", { withTimezone: true }).notNull(),
  fee_cents: integer("fee_cents").default(0),
  deposit_cents: integer("deposit_cents").default(0),
  status: text("status").default("booked").notNull(),
});

export const recipes = pgTable("recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  flour_kg_per_loaf: integer("flour_kg_per_loaf").default(500), // grams per loaf
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const school_classes = pgTable("school_classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(), // e.g. 5a
  teacher_name: text("teacher_name"),
  schedule: jsonb("schedule").default([]),
  homework: jsonb("homework").default([]),
  announcements: jsonb("announcements").default([]),
});

// ---------------------------------------------------------------- Public profiles (one per user)
export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id").references(() => users.id).notNull(),
  tenant_id: uuid("tenant_id").references(() => tenants.id),
  slug: text("slug").notNull(),
  display_name: text("display_name").notNull(),
  headline: text("headline"),
  bio: text("bio"),
  avatar: text("avatar"), // small data URL (png/jpeg/webp ≤ 300 KB)
  theme: text("theme").default("glass").notNull(), // glass | white | purple | green | dark | ocean | sunset | rose
  links: jsonb("links").default([]).notNull(), // [{ kind, label, url }]
  phone: text("phone"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  website: text("website"),
  address: text("address"),
  show_booking: boolean("show_booking").default(false).notNull(),
  show_pharmacy: boolean("show_pharmacy").default(false).notNull(),
  published: boolean("published").default(false).notNull(),
  views: integer("views").default(0).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("uq_profiles_user").on(t.user_id), uniqueIndex("uq_profiles_slug").on(t.slug)]);

// ---------------------------------------------------------------- Card terminals per business
export const terminal_readers = pgTable("terminal_readers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  provider: text("provider").notNull(), // stripe | sumup
  label: text("label").notNull(),
  reader_id: text("reader_id").notNull(), // Stripe tmr_… or SumUp reader/merchant id
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_terminal_readers_tenant").on(t.tenant_id)]);

// Profession modules keep their tables next to their code; re-exported here for convenience.
export * from "../modules/fahrschule/schema";

// Generic business records (customers, suppliers, tasks, patients, expenses, …). The record "kind" decides
// the fields (validated server-side against src/modules/business/kinds.ts); always scoped by tenant_id.
export const biz_records = pgTable("biz_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  kind: text("kind").notNull(),
  data: jsonb("data").default({}).notNull(),
  search: text("search").default("").notNull(), // lower-cased text of the searchable fields
  created_by: uuid("created_by").references(() => users.id),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_biz_records_tenant_kind").on(t.tenant_id, t.kind, t.created_at)]);

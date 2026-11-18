// Module registry — decides which sections each business type sees.
// Core modules are shared code reused by many professions; profession modules add their own pages.
// Adding a profession = one entry here + its folder under src/modules/<key> and src/app/dashboard/m/<key>.
import type { DictKey } from "@/lib/i18n";

export type ModuleKey =
  // shared core modules
  | "appointments" | "reminders" | "pos" | "products" | "invoices" | "accountant" | "ai" | "reports" | "queue"
  // business modules (generic records + special pages)
  | "customers" | "suppliers" | "purchases" | "expenses" | "profits" | "debts" | "tasks" | "messages" | "attendance"
  | "promotions" | "menu" | "ingredients" | "kitchen" | "tables" | "barcode" | "expiry" | "batches" | "drug_categories"
  | "variants" | "categories" | "sales" | "sales_reps" | "employees" | "patients" | "clinic_services" | "no_shows"
  | "prescriptions" | "lab" | "clinic_search" | "closing_days" | "vouchers" | "projects" | "progress_bills" | "daily_price"
  | "properties" | "sellers" | "buyers" | "viewings"
  // profession modules
  | "fahrschule" | "pharmacy";

export type NavIcon =
  | "dashboard" | "pos" | "appointments" | "products" | "invoices" | "accountant" | "ai" | "reports" | "settings"
  | "reminders" | "queue" | "students" | "instructors" | "vehicles" | "lessons" | "theory" | "pharmacy"
  | "customers" | "suppliers" | "purchases" | "expenses" | "profits" | "debts" | "tasks" | "messages" | "attendance" | "promotions"
  | "menu" | "ingredients" | "kitchen" | "tables" | "barcode" | "expiry" | "batches" | "drugcats" | "variants" | "categories"
  | "sales" | "salesreps" | "employees" | "patients" | "services" | "noshow" | "prescriptions" | "lab" | "search" | "closing"
  | "vouchers" | "projects" | "progress" | "dailyprice" | "properties" | "sellers" | "buyers" | "viewings";

/** Sidebar sections; entries are shown grouped in this order. */
export const NAV_GROUPS = ["main", "sales", "clinic", "realestate", "stock", "work", "finance", "team", "insights"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];
export type ModuleNav = { href: string; label: DictKey; icon: NavIcon; perm?: string; ownerOnly?: boolean; group?: NavGroup };
const biz = (kind: string, label: DictKey, icon: NavIcon, group: NavGroup, perm?: string): ModuleNav[] => [{ href: `/dashboard/m/biz/${kind}`, label, icon, group, perm }];

/** Navigation entries contributed by each module (in display order inside the module). */
export const MODULE_NAV: Record<ModuleKey, ModuleNav[]> = {
  fahrschule: [
    { href: "/dashboard/m/fahrschule/lessons", label: "fs_nav_lessons", icon: "lessons", perm: "appointments:read", group: "main" },
    { href: "/dashboard/m/fahrschule/students", label: "fs_nav_students", icon: "students", perm: "appointments:read", group: "main" },
    { href: "/dashboard/m/fahrschule/instructors", label: "fs_nav_instructors", icon: "instructors", perm: "appointments:read", group: "main" },
    { href: "/dashboard/m/fahrschule/vehicles", label: "fs_nav_vehicles", icon: "vehicles", perm: "appointments:read", group: "main" },
    { href: "/dashboard/m/fahrschule/theory", label: "fs_nav_theory", icon: "theory", perm: "appointments:read", group: "main" },
  ],
  pharmacy: [{ href: "/dashboard/m/pharmacy/reservations", label: "ph_nav", icon: "pharmacy", perm: "pos:use", group: "sales" }],
  appointments: [{ href: "/dashboard/appointments", label: "nav_appointments", icon: "appointments", perm: "appointments:read", group: "main" }],
  queue: [{ href: "/dashboard/queue", label: "nav_reception", icon: "queue", perm: "appointments:read", group: "main" }],
  reminders: [{ href: "/dashboard/reminders", label: "nav_reminders", icon: "reminders", perm: "appointments:read", group: "main" }],
  pos: [{ href: "/dashboard/pos", label: "nav_pos", icon: "pos", perm: "pos:use", group: "main" }],
  products: [{ href: "/dashboard/products", label: "nav_products", icon: "products", perm: "products:write", group: "stock" }],
  invoices: [{ href: "/dashboard/invoices", label: "nav_invoices", icon: "invoices", perm: "invoices:read", group: "finance" }],
  reports: [{ href: "/dashboard/reports", label: "nav_reports", icon: "reports", perm: "reports:read", group: "insights" }],
  ai: [{ href: "/dashboard/ai", label: "nav_ai", icon: "ai", perm: "reports:read", group: "insights" }],
  accountant: [{ href: "/dashboard/accountant", label: "nav_accountant", icon: "accountant", ownerOnly: true, group: "finance" }],
  // ---- business modules
  kitchen: [{ href: "/dashboard/m/kitchen", label: "nav_kitchen", icon: "kitchen", perm: "pos:use", group: "main" }],
  tables: biz("tables", "nav_tables", "tables", "main", "pos:use"),
  menu: biz("menu_sections", "nav_menu", "menu", "sales", "pos:use"),
  promotions: biz("promotions", "nav_promotions", "promotions", "sales", "pos:use"),
  sales: [{ href: "/dashboard/m/sales", label: "nav_sales", icon: "sales", perm: "reports:read", group: "sales" }],
  sales_reps: biz("sales_reps", "nav_sales_reps", "salesreps", "sales", "biz:read"),
  customers: biz("customers", "nav_customers", "customers", "sales", "biz:read"),
  daily_price: biz("daily_prices", "nav_daily_price", "dailyprice", "sales", "pos:use"),
  patients: biz("patients", "nav_patients", "patients", "clinic", "appointments:read"),
  clinic_services: biz("clinic_services", "nav_clinic_services", "services", "clinic", "appointments:read"),
  no_shows: [{ href: "/dashboard/m/no-shows", label: "nav_no_shows", icon: "noshow", perm: "appointments:read", group: "clinic" }],
  prescriptions: biz("prescriptions", "nav_prescriptions", "prescriptions", "clinic", "appointments:read"),
  lab: biz("lab_tests", "nav_lab", "lab", "clinic", "appointments:read"),
  clinic_search: [{ href: "/dashboard/m/search", label: "nav_search", icon: "search", perm: "appointments:read", group: "clinic" }],
  closing_days: biz("closing_days", "nav_closing_days", "closing", "clinic", "appointments:read"),
  properties: biz("properties", "nav_properties", "properties", "realestate", "biz:read"),
  sellers: biz("sellers", "nav_sellers", "sellers", "realestate", "biz:read"),
  buyers: biz("buyers", "nav_buyers", "buyers", "realestate", "biz:read"),
  viewings: biz("viewings", "nav_viewings", "viewings", "realestate", "biz:read"),
  ingredients: biz("ingredients", "nav_ingredients", "ingredients", "stock", "products:write"),
  suppliers: biz("suppliers", "nav_suppliers", "suppliers", "stock", "biz:read"),
  purchases: [{ href: "/dashboard/m/purchases", label: "nav_purchases", icon: "purchases", perm: "finance:read", group: "stock" }],
  barcode: [{ href: "/dashboard/m/barcode", label: "nav_barcode", icon: "barcode", perm: "products:write", group: "stock" }],
  expiry: [{ href: "/dashboard/m/expiry", label: "nav_expiry", icon: "expiry", perm: "products:write", group: "stock" }],
  batches: biz("batches", "nav_batches", "batches", "stock", "products:write"),
  drug_categories: biz("drug_categories", "nav_drug_categories", "drugcats", "stock", "products:write"),
  variants: [{ href: "/dashboard/m/variants", label: "nav_variants", icon: "variants", perm: "products:write", group: "stock" }],
  categories: biz("categories", "nav_categories", "categories", "stock", "products:write"),
  projects: biz("projects", "nav_projects", "projects", "work", "biz:read"),
  progress_bills: biz("progress_bills", "nav_progress_bills", "progress", "work", "invoices:read"),
  tasks: biz("tasks", "nav_tasks", "tasks", "work"),
  messages: [{ href: "/dashboard/m/messages", label: "nav_messages", icon: "messages", group: "work" }],
  profits: [{ href: "/dashboard/m/profits", label: "nav_profits", icon: "profits", perm: "finance:read", group: "finance" }],
  expenses: biz("expenses", "nav_expenses", "expenses", "finance", "finance:read"),
  vouchers: biz("vouchers", "nav_vouchers", "vouchers", "finance", "finance:read"),
  debts: [{ href: "/dashboard/m/debts", label: "nav_debts", icon: "debts", perm: "finance:read", group: "finance" }],
  employees: biz("employees", "nav_employees", "employees", "team", "biz:read"),
  attendance: [{ href: "/dashboard/m/attendance", label: "nav_attendance", icon: "attendance", group: "team" }],
};

/**
 * Modules per profession, in menu order. Only these sections (and their buttons) exist for a business;
 * the Root can additionally switch single modules off per business (tenant_features.enabled = false).
 */
export const PROFESSION_MODULES: Record<string, ModuleKey[]> = {
  fahrschule: ["fahrschule", "appointments", "reminders", "invoices", "accountant", "ai"],
  friseur: ["appointments", "reminders", "pos", "invoices", "reports", "ai", "accountant"],
  kiosk: ["pos", "products", "invoices", "reports", "ai", "accountant"],
  design: ["invoices", "reports", "ai", "accountant"],
  steuerbuero: ["invoices", "ai", "accountant"],
  beauty: ["appointments", "reminders", "invoices", "ai", "accountant"],
  buchhandlung: ["pos", "products", "invoices", "reports", "ai", "accountant"],
  schule: ["appointments", "ai"],
  baeckerei: ["pos", "products", "invoices", "reports", "ai", "accountant"],
  kuenstler: ["invoices", "ai", "accountant"],
  restaurant: ["products", "reports", "profits", "pos", "menu", "promotions", "ingredients", "customers", "invoices", "expenses", "suppliers", "purchases",
    "kitchen", "tables", "debts", "tasks", "messages", "attendance", "ai", "accountant"],
  apotheke: ["pharmacy", "products", "reports", "profits", "pos", "customers", "invoices", "expenses", "suppliers", "purchases", "barcode", "expiry",
    "batches", "drug_categories", "debts", "tasks", "messages", "attendance", "ai", "accountant"],
  supermarkt: ["products", "reports", "profits", "pos", "customers", "invoices", "expenses", "suppliers", "purchases", "barcode", "expiry",
    "debts", "tasks", "messages", "attendance", "ai", "accountant"],
  bekleidung: ["products", "reports", "profits", "pos", "promotions", "sales", "sales_reps", "customers", "invoices", "expenses", "suppliers",
    "purchases", "variants", "categories", "employees", "tasks", "debts", "ai", "accountant"],
  praxis: ["reports", "profits", "queue", "patients", "clinic_services", "appointments", "no_shows", "prescriptions", "lab", "invoices",
    "expenses", "tasks", "messages", "clinic_search", "debts", "closing_days", "reminders", "ai"],
  allgemein: ["products", "reports", "profits", "customers", "invoices", "vouchers", "tasks", "projects", "progress_bills", "debts", "suppliers", "purchases", "ai", "accountant"],
  haendler: ["products", "reports", "profits", "customers", "daily_price", "invoices", "suppliers", "purchases", "tasks", "debts", "ai", "accountant"],
  bau: ["products", "reports", "profits", "customers", "invoices", "projects", "progress_bills", "tasks", "suppliers", "purchases", "debts", "messages", "ai", "accountant"],
  immobilien: ["properties", "reports", "profits", "sellers", "buyers", "viewings", "tasks", "projects", "messages", "debts", "invoices", "ai", "accountant"],
  cafe: ["products", "reports", "profits", "pos", "menu", "promotions", "customers", "invoices", "expenses", "suppliers", "purchases",
    "tables", "debts", "tasks", "messages", "attendance", "ai", "accountant"],
};

export const ALL_MODULES = Object.keys(MODULE_NAV) as ModuleKey[];

/** Modules active for a business: profession defaults minus the ones the Root switched off. */
export function activeModules(profession: string, disabled: Iterable<string> = []): Set<ModuleKey> {
  const off = new Set(disabled);
  return new Set((PROFESSION_MODULES[profession] ?? []).filter((m) => !off.has(m)));
}

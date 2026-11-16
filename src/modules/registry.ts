// Module registry — decides which sections each business type sees.
// Core modules are shared code reused by many professions; profession modules add their own pages.
// Adding a profession = one entry here + its folder under src/modules/<key> and src/app/dashboard/m/<key>.
import type { DictKey } from "@/lib/i18n";

export type ModuleKey =
  // shared core modules
  | "appointments" | "reminders" | "pos" | "products" | "invoices" | "accountant" | "ai" | "reports" | "queue"
  // profession modules
  | "fahrschule" | "pharmacy";

export type NavIcon =
  | "dashboard" | "pos" | "appointments" | "products" | "invoices" | "accountant" | "ai" | "reports" | "settings"
  | "reminders" | "queue" | "students" | "instructors" | "vehicles" | "lessons" | "theory" | "pharmacy";

export type ModuleNav = { href: string; label: DictKey; icon: NavIcon; perm?: string; ownerOnly?: boolean };

/** Navigation entries contributed by each module (in display order inside the module). */
export const MODULE_NAV: Record<ModuleKey, ModuleNav[]> = {
  fahrschule: [
    { href: "/dashboard/m/fahrschule/lessons", label: "fs_nav_lessons", icon: "lessons", perm: "appointments:read" },
    { href: "/dashboard/m/fahrschule/students", label: "fs_nav_students", icon: "students", perm: "appointments:read" },
    { href: "/dashboard/m/fahrschule/instructors", label: "fs_nav_instructors", icon: "instructors", perm: "appointments:read" },
    { href: "/dashboard/m/fahrschule/vehicles", label: "fs_nav_vehicles", icon: "vehicles", perm: "appointments:read" },
    { href: "/dashboard/m/fahrschule/theory", label: "fs_nav_theory", icon: "theory", perm: "appointments:read" },
  ],
  pharmacy: [{ href: "/dashboard/m/pharmacy/reservations", label: "ph_nav", icon: "pharmacy", perm: "pos:use" }],
  appointments: [{ href: "/dashboard/appointments", label: "nav_appointments", icon: "appointments", perm: "appointments:read" }],
  queue: [{ href: "/dashboard/queue", label: "q_title", icon: "queue", perm: "appointments:read" }],
  reminders: [{ href: "/dashboard/reminders", label: "nav_reminders", icon: "reminders", perm: "appointments:read" }],
  pos: [{ href: "/dashboard/pos", label: "nav_pos", icon: "pos", perm: "pos:use" }],
  products: [{ href: "/dashboard/products", label: "nav_products", icon: "products", perm: "products:write" }],
  invoices: [{ href: "/dashboard/invoices", label: "nav_invoices", icon: "invoices", perm: "invoices:read" }],
  reports: [{ href: "/dashboard/reports", label: "nav_reports", icon: "reports", perm: "reports:read" }],
  ai: [{ href: "/dashboard/ai", label: "nav_ai", icon: "ai", perm: "reports:read" }],
  accountant: [{ href: "/dashboard/accountant", label: "nav_accountant", icon: "accountant", ownerOnly: true }],
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
  bekleidung: ["pos", "products", "invoices", "reports", "ai", "accountant"],
  praxis: ["queue", "appointments", "reminders", "invoices", "ai"],
  apotheke: ["pharmacy", "pos", "products", "invoices", "reports", "ai", "accountant"],
  kuenstler: ["invoices", "ai", "accountant"],
  restaurant: ["pos", "products", "invoices", "reports", "ai", "accountant"],
  beauty: ["appointments", "reminders", "invoices", "ai", "accountant"],
  buchhandlung: ["pos", "products", "invoices", "reports", "ai", "accountant"],
  schule: ["appointments", "ai"],
  baeckerei: ["pos", "products", "invoices", "reports", "ai", "accountant"],
};

export const ALL_MODULES = Object.keys(MODULE_NAV) as ModuleKey[];

/** Modules active for a business: profession defaults minus the ones the Root switched off. */
export function activeModules(profession: string, disabled: Iterable<string> = []): Set<ModuleKey> {
  const off = new Set(disabled);
  return new Set((PROFESSION_MODULES[profession] ?? []).filter((m) => !off.has(m)));
}

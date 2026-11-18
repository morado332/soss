// Generic business records: each "kind" is a list with typed fields. Pure data (safe to import on the client).
// Server-side validation is generated from these definitions (see ./validate.ts); all rows are tenant-scoped.
import type { Permission } from "@/lib/permissions";

export type FieldType = "text" | "textarea" | "int" | "decimal" | "money" | "percent" | "date" | "datetime" | "select" | "phone" | "email" | "bool" | "ref" | "product" | "staff";
export type Field = {
  key: string; type: FieldType; required?: boolean; options?: readonly string[]; ref?: string;
  list?: boolean; search?: boolean; default?: string | number | boolean; wide?: boolean;
};
export type KindDef = {
  key: string; icon: string; fields: readonly Field[];
  read?: Permission; write?: Permission;
  /** modules that give access to this kind (any of them) */
  modules: readonly string[];
  title: string;       // field used as the row title
  status?: string;     // select field shown as badge
  autoNo?: string;     // prefix → sequential "no" per tenant & kind
  sum?: string;        // money field summed in the header
};

const name = { key: "name", type: "text", required: true, list: true, search: true } as const;
const phone = { key: "phone", type: "phone", list: true, search: true } as const;
const email = { key: "email", type: "email", search: true } as const;
const address = { key: "address", type: "text", wide: true } as const;
const notes = { key: "notes", type: "textarea", wide: true, search: true } as const;

export const KINDS = {
  customers: { key: "customers", icon: "customers", modules: ["customers"], read: "biz:read", write: "biz:write", title: "name",
    fields: [name, phone, email, address, { key: "tax_id", type: "text" }, { key: "credit_limit", type: "money" }, notes] },
  suppliers: { key: "suppliers", icon: "suppliers", modules: ["suppliers", "purchases"], read: "biz:read", write: "biz:write", title: "name",
    fields: [name, { key: "contact", type: "text", list: true, search: true }, phone, email, address, { key: "tax_id", type: "text" }, { key: "payment_terms", type: "int", default: 30 }, notes] },
  tasks: { key: "tasks", icon: "tasks", modules: ["tasks"], title: "title", status: "status",
    fields: [{ key: "title", type: "text", required: true, list: true, search: true, wide: true }, { key: "assignee", type: "staff", list: true },
      { key: "due", type: "date", list: true }, { key: "priority", type: "select", options: ["low", "normal", "high"], default: "normal", list: true },
      { key: "status", type: "select", options: ["todo", "doing", "done"], default: "todo", list: true }, notes] },
  expenses: { key: "expenses", icon: "expenses", modules: ["expenses"], read: "finance:read", write: "finance:read", title: "description", status: "type", sum: "amount",
    fields: [{ key: "type", type: "select", options: ["expense", "income"], default: "expense", required: true, list: true },
      { key: "description", type: "text", required: true, list: true, search: true },
      { key: "category", type: "select", options: ["rent", "salaries", "utilities", "supplies", "marketing", "transport", "taxes", "maintenance", "sales", "other"], default: "other", list: true },
      { key: "amount", type: "money", required: true, list: true }, { key: "date", type: "date", required: true, list: true },
      { key: "method", type: "select", options: ["cash", "card", "transfer"], default: "cash" }, notes] },
  vouchers: { key: "vouchers", icon: "vouchers", modules: ["vouchers"], read: "finance:read", write: "finance:read", title: "party", status: "type", autoNo: "SN", sum: "amount",
    fields: [{ key: "type", type: "select", options: ["receipt", "payment"], default: "receipt", required: true, list: true },
      { key: "party", type: "text", required: true, list: true, search: true }, { key: "amount", type: "money", required: true, list: true },
      { key: "date", type: "date", required: true, list: true }, { key: "method", type: "select", options: ["cash", "card", "transfer", "cheque"], default: "cash", list: true },
      { key: "reference", type: "text", search: true }, notes] },
  menu_sections: { key: "menu_sections", icon: "menu", modules: ["menu"], read: "pos:use", write: "products:write", title: "name",
    fields: [name, { key: "sort", type: "int", default: 1, list: true }, { key: "active", type: "bool", default: true, list: true }, notes] },
  ingredients: { key: "ingredients", icon: "ingredients", modules: ["ingredients"], read: "products:write", write: "products:write", title: "name",
    fields: [name, { key: "unit", type: "select", options: ["kg", "g", "l", "ml", "pcs"], default: "kg", list: true },
      { key: "qty", type: "decimal", list: true }, { key: "min_qty", type: "decimal", list: true }, { key: "unit_cost", type: "money", list: true },
      { key: "supplier", type: "ref", ref: "suppliers" }, notes] },
  tables: { key: "tables", icon: "tables", modules: ["tables"], read: "pos:use", write: "pos:use", title: "name", status: "status",
    fields: [name, { key: "seats", type: "int", default: 4, list: true }, { key: "area", type: "select", options: ["indoor", "outdoor", "terrace", "vip"], default: "indoor", list: true },
      { key: "status", type: "select", options: ["free", "occupied", "reserved"], default: "free", list: true }, notes] },
  promotions: { key: "promotions", icon: "promotions", modules: ["promotions"], read: "pos:use", write: "products:write", title: "name", status: "active",
    fields: [name, { key: "code", type: "text", list: true, search: true }, { key: "discount_type", type: "select", options: ["percent", "fixed"], default: "percent", list: true },
      { key: "value", type: "decimal", required: true, list: true }, { key: "from", type: "date", list: true }, { key: "to", type: "date", list: true },
      { key: "active", type: "bool", default: true, list: true }, notes] },
  sales_reps: { key: "sales_reps", icon: "salesreps", modules: ["sales_reps"], read: "biz:read", write: "biz:write", title: "name",
    fields: [name, phone, email, { key: "commission", type: "percent", list: true }, { key: "target", type: "money", list: true }, { key: "area", type: "text", list: true }, notes] },
  employees: { key: "employees", icon: "employees", modules: ["employees"], read: "biz:read", write: "biz:write", title: "name", status: "active",
    fields: [name, { key: "position", type: "text", list: true, search: true }, phone, email, { key: "salary", type: "money" }, { key: "start", type: "date", list: true },
      { key: "active", type: "bool", default: true, list: true }, notes] },
  categories: { key: "categories", icon: "categories", modules: ["categories"], read: "products:write", write: "products:write", title: "name",
    fields: [name, { key: "type", type: "select", options: ["men", "women", "kids", "unisex", "accessories"], default: "unisex", list: true }, { key: "season", type: "select", options: ["all", "summer", "winter", "spring", "autumn"], default: "all", list: true }, notes] },
  drug_categories: { key: "drug_categories", icon: "drugcats", modules: ["drug_categories"], read: "products:write", write: "products:write", title: "name",
    fields: [name, { key: "code", type: "text", list: true, search: true }, { key: "rx", type: "bool", list: true }, { key: "storage", type: "select", options: ["room", "cool", "frozen"], default: "room", list: true }, notes] },
  batches: { key: "batches", icon: "batches", modules: ["batches", "expiry"], read: "products:write", write: "products:write", title: "batch_no",
    fields: [{ key: "product", type: "product", required: true, list: true }, { key: "batch_no", type: "text", required: true, list: true, search: true },
      { key: "expiry", type: "date", required: true, list: true }, { key: "qty", type: "int", required: true, list: true }, { key: "supplier", type: "ref", ref: "suppliers" }, notes] },
  patients: { key: "patients", icon: "patients", modules: ["patients"], read: "appointments:read", write: "appointments:write", title: "name", autoNo: "P",
    fields: [name, { key: "birth", type: "date", list: true }, { key: "gender", type: "select", options: ["female", "male", "diverse"], list: true }, phone, email,
      { key: "insurance", type: "select", options: ["gkv", "pkv", "self"], default: "gkv", list: true }, { key: "insurance_no", type: "text", search: true },
      { key: "allergies", type: "text", wide: true }, address, notes] },
  clinic_services: { key: "clinic_services", icon: "services", modules: ["clinic_services"], read: "appointments:read", write: "invoices:write", title: "name",
    fields: [name, { key: "code", type: "text", list: true, search: true }, { key: "price", type: "money", required: true, list: true }, { key: "duration", type: "int", default: 15, list: true }, notes] },
  prescriptions: { key: "prescriptions", icon: "prescriptions", modules: ["prescriptions"], read: "appointments:read", write: "appointments:write", title: "patient", autoNo: "RX",
    fields: [{ key: "patient", type: "ref", ref: "patients", required: true, list: true }, { key: "date", type: "date", required: true, list: true },
      { key: "diagnosis", type: "text", list: true, search: true, wide: true }, { key: "medication", type: "textarea", required: true, wide: true, search: true }, notes] },
  lab_tests: { key: "lab_tests", icon: "lab", modules: ["lab"], read: "appointments:read", write: "appointments:write", title: "test", status: "status",
    fields: [{ key: "patient", type: "ref", ref: "patients", required: true, list: true }, { key: "category", type: "select", options: ["lab", "xray", "ultrasound", "mri", "ct", "ecg"], default: "lab", list: true },
      { key: "test", type: "text", required: true, list: true, search: true }, { key: "date", type: "date", list: true },
      { key: "status", type: "select", options: ["requested", "in_progress", "done"], default: "requested", list: true }, { key: "result", type: "textarea", wide: true, search: true }] },
  closing_days: { key: "closing_days", icon: "closing", modules: ["closing_days"], read: "appointments:read", write: "appointments:write", title: "reason",
    fields: [{ key: "from", type: "date", required: true, list: true }, { key: "to", type: "date", required: true, list: true }, { key: "reason", type: "text", required: true, list: true, search: true }] },
  projects: { key: "projects", icon: "projects", modules: ["projects"], read: "biz:read", write: "biz:write", title: "name", status: "status", sum: "budget",
    fields: [name, { key: "client", type: "ref", ref: "customers", list: true }, { key: "location", type: "text", search: true }, { key: "budget", type: "money", list: true },
      { key: "start", type: "date", list: true }, { key: "end", type: "date", list: true }, { key: "progress", type: "percent", list: true },
      { key: "status", type: "select", options: ["planned", "active", "on_hold", "completed"], default: "planned", list: true }, notes] },
  progress_bills: { key: "progress_bills", icon: "progress", modules: ["progress_bills"], read: "invoices:read", write: "invoices:write", title: "project", status: "status", autoNo: "AB", sum: "amount",
    fields: [{ key: "project", type: "ref", ref: "projects", required: true, list: true }, { key: "date", type: "date", required: true, list: true },
      { key: "progress", type: "percent", required: true, list: true }, { key: "amount", type: "money", required: true, list: true }, { key: "retention", type: "percent", default: 5 },
      { key: "status", type: "select", options: ["draft", "submitted", "approved", "paid"], default: "draft", list: true }, notes] },
  daily_prices: { key: "daily_prices", icon: "dailyprice", modules: ["daily_price"], read: "pos:use", write: "products:write", title: "item",
    fields: [{ key: "item", type: "text", required: true, list: true, search: true }, { key: "unit", type: "select", options: ["kg", "t", "pcs", "box", "l", "g"], default: "kg", list: true },
      { key: "buy_price", type: "money", list: true }, { key: "sell_price", type: "money", required: true, list: true }, { key: "date", type: "date", required: true, list: true }, notes] },
  properties: { key: "properties", icon: "properties", modules: ["properties"], read: "biz:read", write: "biz:write", title: "title", status: "status", sum: "price",
    fields: [{ key: "title", type: "text", required: true, list: true, search: true, wide: true }, { key: "ptype", type: "select", options: ["apartment", "house", "land", "office", "shop"], default: "apartment", list: true },
      { key: "deal", type: "select", options: ["sale", "rent"], default: "sale", list: true }, { key: "location", type: "text", list: true, search: true },
      { key: "area", type: "decimal", list: true }, { key: "rooms", type: "int" }, { key: "price", type: "money", required: true, list: true },
      { key: "seller", type: "ref", ref: "sellers" }, { key: "status", type: "select", options: ["available", "reserved", "sold"], default: "available", list: true }, notes] },
  sellers: { key: "sellers", icon: "sellers", modules: ["sellers"], read: "biz:read", write: "biz:write", title: "name",
    fields: [name, phone, email, { key: "asking", type: "money", list: true }, { key: "commission", type: "percent", list: true }, address, notes] },
  buyers: { key: "buyers", icon: "buyers", modules: ["buyers"], read: "biz:read", write: "biz:write", title: "name", status: "stage",
    fields: [name, phone, email, { key: "budget", type: "money", list: true }, { key: "wanted", type: "text", list: true, search: true, wide: true },
      { key: "stage", type: "select", options: ["new", "contacted", "viewing", "offer", "closed", "lost"], default: "new", list: true }, notes] },
  viewings: { key: "viewings", icon: "viewings", modules: ["viewings"], read: "biz:read", write: "biz:write", title: "property", status: "status",
    fields: [{ key: "property", type: "ref", ref: "properties", required: true, list: true }, { key: "buyer", type: "ref", ref: "buyers", required: true, list: true },
      { key: "at", type: "datetime", required: true, list: true }, { key: "agent", type: "staff", list: true },
      { key: "status", type: "select", options: ["planned", "done", "cancelled"], default: "planned", list: true }, { key: "rating", type: "select", options: ["interested", "maybe", "not_interested"] }, notes] },
} as const satisfies Record<string, KindDef>;

export type KindKey = keyof typeof KINDS;
export const isKind = (k: string): k is KindKey => Object.prototype.hasOwnProperty.call(KINDS, k);
export const kindDef = (k: KindKey) => KINDS[k] as unknown as KindDef;

// Driving school module tables — every row is tenant-scoped (tenant_id NOT NULL).
import { pgTable, uuid, text, integer, boolean, timestamp, index, date } from "drizzle-orm/pg-core";
import { tenants, invoices } from "../../db/schema";

export const fs_instructors = pgTable("fs_instructors", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  license_classes: text("license_classes").default("B").notNull(), // e.g. "B, BE, A"
  color: text("color").default("#4f46e5").notNull(),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_fs_instructors_tenant").on(t.tenant_id)]);

export const fs_vehicles = pgTable("fs_vehicles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),            // e.g. "VW Golf 8"
  plate: text("plate").notNull(),          // license plate
  license_class: text("license_class").default("B").notNull(),
  transmission: text("transmission").default("manual").notNull(), // manual | automatic
  next_service: date("next_service"),
  is_active: boolean("is_active").default(true).notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_fs_vehicles_tenant").on(t.tenant_id)]);

export const fs_students = pgTable("fs_students", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  license_class: text("license_class").default("B").notNull(),
  instructor_id: uuid("instructor_id").references(() => fs_instructors.id),
  // Required lessons (45-min units). Class B defaults per FahrschAusbO: 5 Überland, 4 Autobahn, 3 Nacht.
  req_normal: integer("req_normal").default(20).notNull(),
  req_ueberland: integer("req_ueberland").default(5).notNull(),
  req_autobahn: integer("req_autobahn").default(4).notNull(),
  req_nacht: integer("req_nacht").default(3).notNull(),
  theory_progress: integer("theory_progress").default(0).notNull(), // 0–100 %
  theory_external_id: text("theory_external_id"),                 // id in the theory-questions platform
  theory_synced_at: timestamp("theory_synced_at", { withTimezone: true }),
  theory_passed: boolean("theory_passed").default(false).notNull(),
  practical_passed: boolean("practical_passed").default(false).notNull(),
  status: text("status").default("active").notNull(), // active | finished | paused
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_fs_students_tenant").on(t.tenant_id)]);

export const fs_lessons = pgTable("fs_lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenant_id: uuid("tenant_id").references(() => tenants.id).notNull(),
  student_id: uuid("student_id").references(() => fs_students.id).notNull(),
  instructor_id: uuid("instructor_id").references(() => fs_instructors.id).notNull(),
  vehicle_id: uuid("vehicle_id").references(() => fs_vehicles.id),
  type: text("type").default("normal").notNull(), // normal | ueberland | autobahn | nacht | exam
  starts_at: timestamp("starts_at", { withTimezone: true }).notNull(),
  ends_at: timestamp("ends_at", { withTimezone: true }).notNull(),
  units: integer("units").default(1).notNull(), // number of 45-min units (90 min = 2)
  status: text("status").default("scheduled").notNull(), // scheduled | completed | cancelled | no_show
  price_cents: integer("price_cents").default(0).notNull(),
  invoice_id: uuid("invoice_id").references(() => invoices.id),
  notes: text("notes"),
  reminded_24h_at: timestamp("reminded_24h_at", { withTimezone: true }),
  reminded_1h_at: timestamp("reminded_1h_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("idx_fs_lessons_tenant_time").on(t.tenant_id, t.starts_at), index("idx_fs_lessons_student").on(t.student_id)]);

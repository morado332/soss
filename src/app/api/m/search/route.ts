import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, biz_records, invoices } from "@/db/schema";
import { hasPermission } from "@/lib/auth";
import { apiBiz } from "@/modules/business/access";

export const dynamic = "force-dynamic";

// Clinic-wide search: patients, prescriptions, lab/imaging, appointments and invoices of the own practice.
export async function GET(req: NextRequest) {
  const ctx = await apiBiz("appointments:read", ["clinic_search"]);
  if (ctx instanceof NextResponse) return ctx;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const like = `%${q.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`;
  const tid = ctx.tenant.id;
  const recs = await db.select({ id: biz_records.id, kind: biz_records.kind, data: biz_records.data }).from(biz_records)
    .where(and(eq(biz_records.tenant_id, tid), inArray(biz_records.kind, ["patients", "prescriptions", "lab_tests", "clinic_services"]), ilike(biz_records.search, like))).limit(40);
  const appts = await db.select({ id: appointments.id, name: appointments.customer_name, at: appointments.starts_at, status: appointments.status }).from(appointments)
    .where(and(eq(appointments.tenant_id, tid), or(ilike(appointments.customer_name, like), ilike(appointments.customer_phone, like)))).orderBy(desc(appointments.starts_at)).limit(20);
  const invs = hasPermission(ctx.user, "invoices:read") ? await db.select({ id: invoices.id, number: invoices.number, name: invoices.customer_name, total: invoices.total_cents, at: invoices.issued_at }).from(invoices)
    .where(and(eq(invoices.tenant_id, tid), or(ilike(invoices.customer_name, like), ilike(invoices.number, like)))).orderBy(desc(invoices.issued_at)).limit(20) : [];
  return NextResponse.json({ records: recs, appointments: appts, invoices: invs });
}

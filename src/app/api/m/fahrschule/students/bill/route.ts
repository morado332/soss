import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { fs_students, fs_lessons, invoices, invoice_items } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError, nextInvoiceNumber } from "@/lib/guard";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = { normal: "Übungsfahrt", ueberland: "Überlandfahrt", autobahn: "Autobahnfahrt", nacht: "Nachtfahrt", exam: "Prüfungsfahrt" };

// Creates one GoBD invoice for all completed, not yet invoiced lessons of a student.
export async function POST(req: NextRequest) {
  const ctx = await apiTenant("invoices:write", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ student_id: z.string().uuid() }).strict().safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const tid = ctx.tenant.id;
  const taxRate = ctx.tenant.tax_rate_bp ?? 1900;
  const result = await db.transaction(async (tx) => {
    const [st] = await tx.select().from(fs_students).where(and(eq(fs_students.id, parsed.data.student_id), eq(fs_students.tenant_id, tid))).limit(1);
    if (!st) return "NOT_FOUND" as const;
    const open = await tx.select().from(fs_lessons)
      .where(and(eq(fs_lessons.tenant_id, tid), eq(fs_lessons.student_id, st.id), eq(fs_lessons.status, "completed"), isNull(fs_lessons.invoice_id), gt(fs_lessons.price_cents, 0)))
      .orderBy(asc(fs_lessons.starts_at)).for("update");
    if (!open.length) return "NOTHING" as const;
    const gross = open.reduce((s, l) => s + l.price_cents, 0);
    const tax = Math.round((gross * taxRate) / (10000 + taxRate));
    const number = await nextInvoiceNumber(tx, tid);
    const [inv] = await tx.insert(invoices).values({
      tenant_id: tid, number, type: "invoice", status: "issued", customer_name: st.name, customer_email: st.email,
      subtotal_cents: gross - tax, tax_cents: tax, total_cents: gross, tax_rate_bp: taxRate,
    }).returning();
    await tx.insert(invoice_items).values(open.map((l) => ({
      invoice_id: inv.id, tenant_id: tid, quantity: 1, unit_price_cents: l.price_cents, total_cents: l.price_cents,
      name: `${LABEL[l.type] ?? l.type} ${l.units * 45} Min. · ${l.starts_at.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`,
    })));
    for (const l of open) await tx.update(fs_lessons).set({ invoice_id: inv.id }).where(and(eq(fs_lessons.id, l.id), eq(fs_lessons.tenant_id, tid)));
    return inv;
  });
  if (result === "NOT_FOUND") return jsonError("NOT_FOUND", 404);
  if (result === "NOTHING") return jsonError("NOTHING_TO_BILL", 400);
  await audit(ctx.user.id, tid, "fs.student.bill", "invoice", result.id, null, { number: result.number, total_cents: result.total_cents });
  return NextResponse.json({ ok: true, invoice: { id: result.id, number: result.number } });
}

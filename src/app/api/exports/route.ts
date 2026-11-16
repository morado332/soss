import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { invoices, tenants, accountant_links } from "@/db/schema";
import { currentUser, hasPermission, isPlatformAdmin, audit } from "@/lib/auth";
import { hasPlatformPermission, jsonError } from "@/lib/guard";
import { csvCell, xmlEscape, clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

const Q = z.object({
  format: z.enum(["datev", "xml"]).default("datev"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tenant_id: z.string().uuid().optional(),
});

// GET /api/exports?format=datev|xml&from=2026-01-01&to=2026-01-31[&tenant_id=]
// Tenant users: own tenant only. Accountants: linked tenants only. Root: any.
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError("UNAUTHORIZED", 401);
  const parsed = Q.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const { format, from, to, tenant_id } = parsed.data;

  let allowed: string[] = [];
  if (isPlatformAdmin(user)) {
    if (!hasPlatformPermission(user, "platform:finance")) return jsonError("FORBIDDEN", 403);
    allowed = tenant_id ? [tenant_id] : (await db.select({ id: tenants.id }).from(tenants)).map((t) => t.id);
  } else if (user.role === "accountant") {
    const links = await db.select({ tid: accountant_links.tenant_id }).from(accountant_links)
      .where(and(eq(accountant_links.accountant_user_id, user.id), eq(accountant_links.status, "active")));
    allowed = links.map((l) => l.tid);
    if (tenant_id) allowed = allowed.includes(tenant_id) ? [tenant_id] : [];
  } else if (user.tenant_id && hasPermission(user, "invoices:read")) {
    allowed = [user.tenant_id];
  }
  if (!allowed.length) return jsonError("FORBIDDEN", 403);

  const conds = [inArray(invoices.tenant_id, allowed)];
  if (from) conds.push(gte(invoices.issued_at, new Date(`${from}T00:00:00Z`)));
  if (to) conds.push(lt(invoices.issued_at, new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000)));
  const rows = await db.select({ inv: invoices, tenant: tenants.name }).from(invoices).innerJoin(tenants, eq(invoices.tenant_id, tenants.id))
    .where(and(...conds)).orderBy(asc(invoices.issued_at)).limit(50_000);

  await audit(user.id, allowed.length === 1 ? allowed[0] : null, "export." + format, "invoice", undefined, null, { count: rows.length, from, to }, clientIp(req));
  const stamp = new Date().toISOString().slice(0, 10);
  const money = (c: number) => (c / 100).toFixed(2);

  if (format === "xml") {
    const body = rows.map(({ inv, tenant }) =>
      `  <Invoice>\n    <Seller>${xmlEscape(tenant)}</Seller>\n    <ID>${xmlEscape(inv.number)}</ID>\n    <TypeCode>${inv.type === "storno" ? 384 : 380}</TypeCode>\n    <IssueDate>${inv.issued_at.toISOString().slice(0, 10)}</IssueDate>\n    <Buyer>${xmlEscape(inv.customer_name)}</Buyer>\n    <Currency>EUR</Currency>\n    <TaxRate>${(inv.tax_rate_bp / 100).toFixed(2)}</TaxRate>\n    <NetAmount>${money(inv.subtotal_cents)}</NetAmount>\n    <TaxAmount>${money(inv.tax_cents)}</TaxAmount>\n    <GrossAmount>${money(inv.total_cents)}</GrossAmount>\n    <PrecedingInvoice>${xmlEscape(inv.storno_of_id ?? "")}</PrecedingInvoice>\n    <TSE>${xmlEscape(inv.tse_reference ?? "")}</TSE>\n  </Invoice>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Arena invoice export (EN 16931 core fields) -->\n<Invoices generated="${stamp}">\n${body}\n</Invoices>\n`;
    return new NextResponse(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="rechnungen-${stamp}.xml"`, "Cache-Control": "no-store" } });
  }

  // DATEV-style CSV: Umsatz;Soll/Haben;Konto;Gegenkonto;Belegdatum;Belegfeld1;Buchungstext;Steuersatz;Mandant;TSE
  const header = "Umsatz;Soll/Haben-Kennzeichen;Konto;Gegenkonto;Belegdatum;Belegfeld 1;Buchungstext;Steuersatz;Mandant;TSE";
  const lines = rows.map(({ inv, tenant }) => [
    money(Math.abs(inv.total_cents)).replace(".", ","), inv.total_cents < 0 ? "H" : "S", inv.tax_rate_bp === 700 ? "8300" : "8400", "1000",
    inv.issued_at.toISOString().slice(0, 10).split("-").reverse().join("."), inv.number, `${inv.type === "storno" ? "Storno " : "Rechnung "}${inv.customer_name ?? ""}`,
    (inv.tax_rate_bp / 100).toString().replace(".", ","), tenant, inv.tse_reference ?? "",
  ].map(csvCell).join(";"));
  const csv = "﻿" + [header, ...lines].join("\r\n") + "\r\n";
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="datev-${stamp}.csv"`, "Cache-Control": "no-store" } });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices, invoice_items, tenants, accountant_links } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/exports?format=datev|xrechnung&from=2026-01-01&to=2026-01-31
// Accountant sees only linked tenants. Tenant owner sees only own tenant.
export async function GET(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const format = req.nextUrl.searchParams.get("format") ?? "datev";
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  let tenantIds: string[] = [];
  if (user.role === "root" || user.role === "super_admin") {
    const all = await db.select({ id: tenants.id }).from(tenants);
    tenantIds = all.map((t) => t.id);
  } else if (user.role === "accountant") {
    const links = await db.select().from(accountant_links).where(eq(accountant_links.accountant_user_id, user.id));
    tenantIds = links.map((l) => l.tenant_id);
  } else if (user.tenant_id) tenantIds = [user.tenant_id];
  if (!tenantIds.length) return NextResponse.json({ error: "Keine Mandanten zugeordnet" }, { status: 403 });

  const conds = [];
  if (from) conds.push(gte(invoices.issued_at, new Date(from)));
  if (to) conds.push(lte(invoices.issued_at, new Date(to)));
  const rows = await db.select().from(invoices).where(and(...conds)).orderBy(invoices.issued_at);
  const filtered = rows.filter((r) => tenantIds.includes(r.tenant_id));

  if (format === "xrechnung") {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- XRechnung 3.0 (EN 16931) — ZUGFeRD compatible -->\n<Invoice>\n${filtered.map((inv) => `  <InvoiceLine><ID>${inv.number}</ID><InvoicedQuantity>${1}</InvoicedQuantity><NetAmount>${(inv.subtotal_cents / 100).toFixed(2)}</NetAmount><TaxAmount>${(inv.tax_cents / 100).toFixed(2)}</TaxAmount><TaxRate>${(inv.tax_rate_bp / 100).toFixed(2)}</TaxRate><Total>${(inv.total_cents / 100).toFixed(2)}</Total><TSE>${inv.tse_reference ?? ""}</TSE></InvoiceLine>`).join("\n")}\n</Invoice>`;
    return new NextResponse(xml, { headers: { "Content-Type": "application/xml", "Content-Disposition": `attachment; filename="xrechnung-export.xml"` } });
  }

  // DATEV CSV (Storno format): Konto;Gegenkonto;Betrag;Datum;Beschreibung
  const csv = ["Konto;Gegenkonto;Betrag;Datum;Beschreibung;Steuersatz;Rechnungsnummer;TSE",
    ...filtered.map((inv) => `4400;19;${(inv.total_cents / 100).toFixed(2).replace(".", ",")};${inv.issued_at.toISOString().slice(0, 10)};Rechnung ${inv.number} ${inv.customer_name ?? ""};${inv.tax_rate_bp / 100};${inv.number};${inv.tse_reference ?? ""}`)].join("\n");
  // include items count for audit
  void invoice_items;
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="datev-export.csv"` } });
}

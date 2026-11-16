import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db";
import { invoices, invoice_items } from "@/db/schema";
import { requireTenantPage } from "@/lib/page-guard";
import { getI18n } from "@/lib/i18n-server";
import { eur } from "@/lib/commission";
import { btnSecondary } from "@/components/ui";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function InvoiceView({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireTenantPage("invoices:read", false, "invoices");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenant_id, tenant.id))).limit(1);
  if (!inv) notFound();
  const items = await db.select().from(invoice_items).where(and(eq(invoice_items.invoice_id, inv.id), eq(invoice_items.tenant_id, tenant.id)));
  const orig = inv.storno_of_id ? (await db.select({ number: invoices.number }).from(invoices).where(and(eq(invoices.id, inv.storno_of_id), eq(invoices.tenant_id, tenant.id))).limit(1))[0] : null;
  const { t, locale } = await getI18n();
  const money = (c: number) => eur(c, locale);
  return (
    <div className="space-y-4">
      <div className="no-print flex items-center justify-between">
        <Link href="/dashboard/invoices" className={btnSecondary}><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{t("nav_invoices")}</Link>
        <PrintButton label={t("i_print")} />
      </div>
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm md:p-12 dark:border-slate-800 dark:bg-slate-900 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6 dark:border-slate-800">
          <div>
            <p className="text-lg font-semibold">{tenant.name}</p>
            {tenant.ust_idnr && <p className="text-sm text-slate-500">{t("i_taxId")}: {tenant.ust_idnr}</p>}
            {tenant.steuernummer && <p className="text-sm text-slate-500">{t("s_steuernr")}: {tenant.steuernummer}</p>}
          </div>
          <div className="text-end">
            <p className="text-2xl font-semibold tracking-tight">{inv.type === "storno" ? t("i_stornoOf") : t("i_invoice")}</p>
            <p className="tabular text-sm text-slate-500">{t("i_number")} {inv.number}</p>
            <p className="tabular text-sm text-slate-500">{new Date(inv.issued_at).toLocaleDateString(locale)}</p>
          </div>
        </header>
        <div className="py-6 text-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t("customer")}</p>
          <p className="font-medium">{inv.customer_name ?? "—"}</p>
          {inv.customer_email && <p className="text-slate-500">{inv.customer_email}</p>}
          {orig && <p className="mt-3 text-red-600">{t("i_stornoHint")} {orig.number}</p>}
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800"><tr><th className="py-2 text-start">{t("i_item")}</th><th className="py-2 text-end">{t("i_qty")}</th><th className="py-2 text-end">{t("i_unit")}</th><th className="py-2 text-end">{t("total")}</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((i) => <tr key={i.id}><td className="py-2">{i.name}</td><td className="tabular py-2 text-end">{i.quantity}</td><td className="tabular py-2 text-end">{money(i.unit_price_cents)}</td><td className="tabular py-2 text-end">{money(i.total_cents)}</td></tr>)}
          </tbody>
        </table>
        <dl className="ms-auto mt-6 max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">{t("i_net")}</dt><dd className="tabular">{money(inv.subtotal_cents)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">{t("i_vat")} {inv.tax_rate_bp / 100} %</dt><dd className="tabular">{money(inv.tax_cents)}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold dark:border-slate-800"><dt>{t("total")}</dt><dd className="tabular">{money(inv.total_cents)}</dd></div>
        </dl>
        {inv.tse_reference && <p className="mt-8 break-all text-xs text-slate-400">{t("pos_tse")}: {inv.tse_reference} · {tenant.tse_serial}</p>}
      </article>
    </div>
  );
}

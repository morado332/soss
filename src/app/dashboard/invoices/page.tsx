import { requireTenantPage } from "@/lib/page-guard";
import { hasPermission } from "@/lib/auth";
import InvoicesClient from "./invoices-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user, tenant } = await requireTenantPage("invoices:read");
  return <InvoicesClient canWrite={hasPermission(user, "invoices:write")} defaultTax={tenant.tax_rate_bp ?? 1900} />;
}

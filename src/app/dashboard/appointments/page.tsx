import { requireTenantPage } from "@/lib/page-guard";
import { hasPermission } from "@/lib/auth";
import AppointmentsClient from "./appointments-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user, tenant } = await requireTenantPage("appointments:read");
  return <AppointmentsClient canWrite={hasPermission(user, "appointments:write")} showQueue={tenant.profession === "praxis"} slug={tenant.slug} />;
}

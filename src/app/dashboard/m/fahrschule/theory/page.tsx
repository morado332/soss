import { hasPermission } from "@/lib/auth";
import { requireTenantPage } from "@/lib/page-guard";
import TheoryClient from "./theory-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user } = await requireTenantPage("appointments:read", false, "fahrschule");
  return <TheoryClient canManage={hasPermission(user, "fahrschule:manage")} />;
}

import { hasPermission } from "@/lib/auth";
import { requireTenantPage } from "@/lib/page-guard";
import InstructorsClient from "./instructors-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user } = await requireTenantPage("appointments:read", false, "fahrschule");
  return <InstructorsClient canManage={hasPermission(user, "fahrschule:manage")} />;
}

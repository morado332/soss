import { hasPermission } from "@/lib/auth";
import { requireTenantPage } from "@/lib/page-guard";
import RemindersClient from "./reminders-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user } = await requireTenantPage("appointments:read", false, "reminders");
  return <RemindersClient canRun={hasPermission(user, "appointments:write")} />;
}

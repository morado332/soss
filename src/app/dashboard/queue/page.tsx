import { hasPermission } from "@/lib/auth";
import { requireTenantPage } from "@/lib/page-guard";
import QueueClient from "./queue-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user } = await requireTenantPage("appointments:read", false, "queue");
  return <QueueClient canWrite={hasPermission(user, "appointments:write")} />;
}

import { hasPermission } from "@/lib/auth";
import { requireTenantPage } from "@/lib/page-guard";
import LessonsClient from "./lessons-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user } = await requireTenantPage("appointments:read", false, "fahrschule");
  return <LessonsClient canWrite={hasPermission(user, "appointments:write")} />;
}

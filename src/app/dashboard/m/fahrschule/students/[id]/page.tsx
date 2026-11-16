import { notFound } from "next/navigation";
import { hasPermission } from "@/lib/auth";
import { requireTenantPage } from "@/lib/page-guard";
import StudentDetail from "./student-detail";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireTenantPage("appointments:read", false, "fahrschule");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <StudentDetail id={id} canManage={hasPermission(user, "fahrschule:manage")} canBill={hasPermission(user, "invoices:write")} />;
}

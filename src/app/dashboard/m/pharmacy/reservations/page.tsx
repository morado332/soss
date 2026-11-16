import { requireTenantPage } from "@/lib/page-guard";
import PharmacyClient from "./pharmacy-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { user } = await requireTenantPage("pos:use", false, "pharmacy");
  return <PharmacyClient owner={user.role === "tenant_owner"} />;
}

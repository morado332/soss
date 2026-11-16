import { requireTenantPage } from "@/lib/page-guard";
import PosClient from "./pos-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireTenantPage("pos:use", false, "pos");
  return <PosClient />;
}

import { requireTenantPage } from "@/lib/page-guard";
import AccountantClient from "./accountant-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireTenantPage(undefined, true, "accountant");
  return <AccountantClient />;
}

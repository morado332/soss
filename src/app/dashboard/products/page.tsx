import { requireTenantPage } from "@/lib/page-guard";
import ProductsClient from "./products-client";
export const dynamic = "force-dynamic";
export default async function Page() {
  await requireTenantPage("products:write", false, "products");
  return <ProductsClient />;
}

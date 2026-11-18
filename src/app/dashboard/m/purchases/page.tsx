import { requireModulePage } from "@/lib/module-page";
import PurchasesClient from "./purchases-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireModulePage("finance:read", ["purchases"]); return <PurchasesClient />; }

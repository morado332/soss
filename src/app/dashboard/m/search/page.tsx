import { requireModulePage } from "@/lib/module-page";
import SearchClient from "./search-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireModulePage("appointments:read", ["clinic_search"]); return <SearchClient />; }

import { requireModulePage } from "@/lib/module-page";
import ExpiryClient from "./expiry-client";
export const dynamic = "force-dynamic";
export default async function Page() { const { can } = await requireModulePage("products:write", ["expiry"]); return <ExpiryClient canWrite={can("products:write")} />; }

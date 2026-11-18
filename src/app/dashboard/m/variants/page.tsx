import { requireModulePage } from "@/lib/module-page";
import VariantsClient from "./variants-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireModulePage("products:write", ["variants"]); return <VariantsClient />; }

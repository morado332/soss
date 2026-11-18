import { requireModulePage } from "@/lib/module-page";
import KitchenClient from "./kitchen-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireModulePage("pos:use", ["kitchen"]); return <KitchenClient />; }

import { requireModulePage } from "@/lib/module-page";
import BarcodeClient from "./barcode-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireModulePage("products:write", ["barcode"]); return <BarcodeClient />; }

import { requireRootPage } from "@/lib/page-guard";
import PaymentsClient from "./payments-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRootPage("platform:payments"); return <PaymentsClient />; }

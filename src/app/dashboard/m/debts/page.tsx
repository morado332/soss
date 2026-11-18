import { requireModulePage } from "@/lib/module-page";
import DebtsClient from "./debts-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireModulePage("finance:read", ["debts"]); return <DebtsClient />; }

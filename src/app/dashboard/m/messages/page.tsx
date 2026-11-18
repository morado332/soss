import { requireModulePage } from "@/lib/module-page";
import MessagesClient from "./messages-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireModulePage(undefined, ["messages"]); return <MessagesClient />; }

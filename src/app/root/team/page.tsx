import { requireRootPage } from "@/lib/page-guard";
import TeamClient from "./team-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRootPage("root"); return <TeamClient />; }

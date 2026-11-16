import { requireRootPage } from "@/lib/page-guard";
import C from "./tenants-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRootPage("platform:tenants"); return <C />; }

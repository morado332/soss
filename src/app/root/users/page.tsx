import { requireRootPage } from "@/lib/page-guard";
import UsersClient from "./users-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRootPage("platform:tenants"); return <UsersClient />; }

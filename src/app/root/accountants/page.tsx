import { requireRootPage } from "@/lib/page-guard";
import C from "./accountants-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRootPage(); return <C />; }

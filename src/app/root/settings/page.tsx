import { requireRootPage } from "@/lib/page-guard";
import { getBranding } from "@/core/platform";
import SettingsClient from "./settings-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRootPage("platform:settings"); return <SettingsClient initial={await getBranding()} />; }

import { requireModulePage } from "@/lib/module-page";
import AttendanceClient from "./attendance-client";
export const dynamic = "force-dynamic";
export default async function Page() { await requireModulePage(undefined, ["attendance"]); return <AttendanceClient />; }

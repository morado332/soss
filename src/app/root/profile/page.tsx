import { requireRootPage } from "@/lib/page-guard";
import ProfileEditor from "@/components/profile-editor";
export const dynamic = "force-dynamic";
export default async function Page() { await requireRootPage(); return <ProfileEditor />; }

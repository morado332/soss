import { redirect } from "next/navigation";
import { currentUser, isPlatformAdmin } from "@/lib/auth";
import ProfileEditor from "@/components/profile-editor";
export const dynamic = "force-dynamic";
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (isPlatformAdmin(u)) redirect("/root/profile");
  return <ProfileEditor />;
}

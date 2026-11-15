import { redirect } from "next/navigation";
import { currentUser, isPlatformAdmin } from "@/lib/auth";
import { requireTenantPage } from "@/lib/page-guard";
import { getI18n } from "@/lib/i18n-server";
import { Card, PageHeader } from "@/components/ui";
import { PasswordForm } from "@/components/password-form";
import SettingsClient from "./settings-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (isPlatformAdmin(user)) redirect("/root/account");
  const { t } = await getI18n();
  if (user.role === "accountant") {
    return (
      <div className="space-y-6">
        <PageHeader title={t("s_title")} />
        <div className="max-w-lg"><Card title={t("s_security")}><PasswordForm /></Card></div>
      </div>
    );
  }
  const { tenant } = await requireTenantPage();
  return <SettingsClient isOwner={user.role === "tenant_owner"} slug={tenant.slug} />;
}

import { requireRootPage } from "@/lib/page-guard";
import { getI18n } from "@/lib/i18n-server";
import { Card, PageHeader } from "@/components/ui";
import { PasswordForm } from "@/components/password-form";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  await requireRootPage();
  const { t } = await getI18n();
  return (
    <div className="space-y-6">
      <PageHeader title={t("root_tabAccount")} />
      <div className="max-w-lg"><Card title={t("s_changePw")}><PasswordForm /></Card></div>
    </div>
  );
}

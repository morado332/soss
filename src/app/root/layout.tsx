import { requireRootPage } from "@/lib/page-guard";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getI18n, getTheme } from "@/lib/i18n-server";
import type { DictKey } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRootPage();
  const { t } = await getI18n();
  const theme = await getTheme();
  const nav: NavItem[] = [
    { href: "/root", label: "root_tabOverview", icon: "dashboard", exact: true },
    { href: "/root/tenants", label: "root_tabTenants", icon: "tenants" },
    { href: "/root/accountants", label: "root_tabAccountants", icon: "accountant" },
    { href: "/root/audit", label: "root_tabAudit", icon: "audit" },
    { href: "/root/account", label: "root_tabAccount", icon: "account" },
  ];
  return (
    <AppShell nav={nav} theme={theme} user={{ name: user.name, email: user.email, role: `role_${user.role}` as DictKey }} context={{ title: t("root_title"), subtitle: "Root", icon: "🛡️" }}>
      {children}
    </AppShell>
  );
}

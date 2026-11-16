import { requireRootPage } from "@/lib/page-guard";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getI18n, getTheme } from "@/lib/i18n-server";
import type { DictKey } from "@/lib/i18n";
import type { PlatformPermission } from "@/lib/permissions";
import { hasPlatformPermission } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRootPage();
  const { t } = await getI18n();
  const theme = await getTheme();
  const all: (NavItem & { perm?: PlatformPermission | "root" })[] = [
    { href: "/root", label: "root_tabOverview", icon: "dashboard", exact: true },
    { href: "/root/tenants", label: "root_tabTenants", icon: "tenants", perm: "platform:tenants" },
    { href: "/root/users", label: "p2_users", icon: "users", perm: "platform:tenants" },
    { href: "/root/team", label: "p2_team", icon: "team", perm: "root" },
    { href: "/root/accountants", label: "root_tabAccountants", icon: "accountant", perm: "platform:accountants" },
    { href: "/root/payments", label: "p2_payments", icon: "payments", perm: "platform:payments" },
    { href: "/root/settings", label: "p2_branding", icon: "branding", perm: "platform:settings" },
    { href: "/root/audit", label: "root_tabAudit", icon: "audit", perm: "platform:audit" },
    { href: "/root/profile", label: "p2_myProfile", icon: "profile" },
    { href: "/root/account", label: "root_tabAccount", icon: "account" },
  ];
  // Every staff member only sees the sections they are allowed to open.
  const nav: NavItem[] = all.filter((n) => !n.perm || hasPlatformPermission(user, n.perm)).map(({ perm: _p, ...n }) => n);
  return (
    <AppShell nav={nav} theme={theme} user={{ name: user.name, email: user.email, role: `role_${user.role}` as DictKey }} context={{ title: t("root_title"), subtitle: "Root", icon: "🛡️" }}>
      {children}
    </AppShell>
  );
}

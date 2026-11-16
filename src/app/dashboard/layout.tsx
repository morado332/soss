import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, notifications } from "@/db/schema";
import { currentUser, hasPermission, isPlatformAdmin } from "@/lib/auth";
import { professionByKey, professionName } from "@/lib/professions";
import { AppShell, type NavItem } from "@/components/app-shell";
import { getI18n, getTheme } from "@/lib/i18n-server";
import type { DictKey } from "@/lib/i18n";
import { tenantModules } from "@/lib/guard";
import { MODULE_NAV } from "@/modules/registry";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (isPlatformAdmin(user)) redirect("/root");
  const { lang, t } = await getI18n();
  const theme = await getTheme();
  const role = `role_${user.role}` as DictKey;

  if (user.role === "accountant") {
    const nav: NavItem[] = [
      { href: "/dashboard", label: "nav_clients", icon: "users", exact: true },
      { href: "/dashboard/settings", label: "nav_settings", icon: "settings" },
    ];
    return (
      <AppShell nav={nav} theme={theme} user={{ name: user.name, email: user.email, role }} context={{ title: user.name, subtitle: `${t("acc_yourId")}: ${user.accountant_id ?? "—"}`, icon: "🧾" }}>
        {children}
      </AppShell>
    );
  }

  if (!user.tenant_id) redirect("/login");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenant_id)).limit(1);
  if (!tenant) redirect("/login");
  const notifs = await db.select({ id: notifications.id, title: notifications.title, body: notifications.body, created_at: notifications.created_at })
    .from(notifications).where(and(eq(notifications.tenant_id, tenant.id), eq(notifications.is_read, false))).orderBy(desc(notifications.created_at)).limit(8);
  const prof = professionByKey(tenant.profession);
  // Menu = only the modules of this business type (see src/modules/registry.ts), filtered by staff permissions.
  const modules = await tenantModules(tenant);
  const nav: NavItem[] = [{ href: "/dashboard", label: "nav_dashboard", icon: "dashboard", exact: true }];
  for (const m of modules) {
    for (const item of MODULE_NAV[m]) {
      if (item.ownerOnly && user.role !== "tenant_owner") continue;
      if (item.perm && !hasPermission(user, item.perm)) continue;
      nav.push({ href: item.href, label: item.label, icon: item.icon });
    }
  }
  nav.push({ href: "/dashboard/settings", label: "nav_settings", icon: "settings" });
  return (
    <AppShell
      nav={nav} theme={theme} user={{ name: user.name, email: user.email, role }}
      context={{ title: tenant.name, subtitle: `${professionName(prof, lang)} · ${tenant.plan}`, icon: prof.icon, link: { href: `/book/${tenant.slug}`, label: t("bookingLink") } }}
      notifications={notifs.map((n) => ({ ...n, created_at: n.created_at.toISOString() }))}
      banner={tenant.status === "suspended" || tenant.status === "cancelled" ? "suspended" : null}
    >
      {children}
    </AppShell>
  );
}

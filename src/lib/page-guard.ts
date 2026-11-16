import "server-only";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { currentUser, hasPermission, isPlatformAdmin, type CurrentUser } from "./auth";
import type { Permission } from "./permissions";
import { tenantModules, type Tenant } from "./guard";
import type { ModuleKey } from "@/modules/registry";

/** Server-side guard for tenant pages: redirects instead of rendering anything unauthorised. */
export async function requireTenantPage(perm?: Permission, ownerOnly = false, module?: ModuleKey): Promise<{ user: CurrentUser; tenant: Tenant }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (isPlatformAdmin(user)) redirect("/root");
  if (!user.tenant_id || (user.role !== "tenant_owner" && user.role !== "tenant_staff")) redirect("/dashboard");
  if ((perm && !hasPermission(user, perm)) || (ownerOnly && user.role !== "tenant_owner")) redirect("/dashboard");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenant_id)).limit(1);
  if (!tenant) redirect("/login");
  if (module && !(await tenantModules(tenant)).has(module)) redirect("/dashboard");
  return { user, tenant };
}

export async function requireRootPage(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!isPlatformAdmin(user)) redirect("/dashboard");
  return user;
}

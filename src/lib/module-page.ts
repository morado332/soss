import "server-only";
import { redirect } from "next/navigation";
import { hasPermission } from "./auth";
import { requireTenantPage } from "./page-guard";
import { tenantModules } from "./guard";
import type { Permission } from "./permissions";

/** Page guard for business modules: permission + any of the modules active for this business. */
export async function requireModulePage(perm: Permission | undefined, modules: readonly string[]) {
  const ctx = await requireTenantPage(perm);
  const mods = await tenantModules(ctx.tenant);
  if (!modules.some((m) => mods.has(m as never))) redirect("/dashboard");
  const can = (p?: Permission) => !p || hasPermission(ctx.user, p);
  return { ...ctx, mods, can };
}

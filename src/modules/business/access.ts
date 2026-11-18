import "server-only";
import { NextResponse } from "next/server";
import { apiTenant, jsonError, tenantModules, type TenantCtx } from "@/lib/guard";
import type { Permission } from "@/lib/permissions";

/** API guard for business modules: permission + at least one of the given modules active for this business. */
export async function apiBiz(perm: Permission | undefined, modules: readonly string[], write = false): Promise<TenantCtx | NextResponse> {
  const ctx = await apiTenant(perm, { write });
  if (ctx instanceof NextResponse) return ctx;
  const mods = await tenantModules(ctx.tenant);
  if (!modules.some((m) => mods.has(m as never))) return jsonError("MODULE_DISABLED", 403);
  return ctx;
}

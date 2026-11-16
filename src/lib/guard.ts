import "server-only";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants, invoice_counters, tenant_features } from "@/db/schema";
import { activeModules, type ModuleKey } from "@/modules/registry";
import { currentUser, hasPermission, isPlatformAdmin, type CurrentUser } from "./auth";
import type { Permission, PlatformPermission } from "./permissions";

export type Tenant = typeof tenants.$inferSelect;
export type TenantCtx = { user: CurrentUser; tenant: Tenant };

export const jsonError = (error: string, status: number, extra?: Record<string, unknown>) =>
  NextResponse.json({ error, ...extra }, { status });

/** Any authenticated user. */
export async function apiUser(): Promise<CurrentUser | NextResponse> {
  const user = await currentUser();
  return user ?? jsonError("UNAUTHORIZED", 401);
}

/** Platform staff: the Root has every permission, a Super Admin only the ones the Root granted. */
export function hasPlatformPermission(user: CurrentUser, perm?: PlatformPermission | "root") {
  if (user.role === "root") return true;
  if (user.role !== "super_admin" || !perm || perm === "root") return false;
  return ((user.permissions as string[] | null) ?? []).includes(perm);
}

/** Platform admins. Without a permission: Root only. */
export async function apiRoot(perm?: PlatformPermission | "root"): Promise<CurrentUser | NextResponse> {
  const user = await currentUser();
  if (!user) return jsonError("UNAUTHORIZED", 401);
  if (!isPlatformAdmin(user)) return jsonError("FORBIDDEN", 403);
  if (!hasPlatformPermission(user, perm ?? "root")) return jsonError("FORBIDDEN_PERMISSION", 403);
  return user;
}

/**
 * Tenant-scoped access: user must belong to a tenant, hold the permission,
 * and for write operations the tenant must not be suspended/cancelled.
 */
/** Modules enabled for a business (profession defaults minus modules the Root switched off). */
export async function tenantModules(tenant: Pick<Tenant, "id" | "profession">): Promise<Set<ModuleKey>> {
  const off = await db.select({ key: tenant_features.feature_key }).from(tenant_features)
    .where(and(eq(tenant_features.tenant_id, tenant.id), eq(tenant_features.enabled, false)));
  return activeModules(tenant.profession, off.map((o) => o.key));
}

export async function apiTenant(perm?: Permission, opts: { write?: boolean; ownerOnly?: boolean; module?: ModuleKey } = {}): Promise<TenantCtx | NextResponse> {
  const user = await currentUser();
  if (!user) return jsonError("UNAUTHORIZED", 401);
  if (!user.tenant_id || (user.role !== "tenant_owner" && user.role !== "tenant_staff")) return jsonError("FORBIDDEN", 403);
  if (opts.ownerOnly && user.role !== "tenant_owner") return jsonError("FORBIDDEN", 403);
  if (perm && !hasPermission(user, perm)) return jsonError("FORBIDDEN_PERMISSION", 403);
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenant_id)).limit(1);
  if (!tenant) return jsonError("TENANT_NOT_FOUND", 404);
  if (opts.module && !(await tenantModules(tenant)).has(opts.module)) return jsonError("MODULE_DISABLED", 403);
  if (opts.write && (tenant.status === "suspended" || tenant.status === "cancelled")) return jsonError("TENANT_SUSPENDED", 403);
  return { user, tenant };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Atomically reserve the next sequential invoice number for a tenant (race-safe, gap-free per year). */
export async function nextInvoiceNumber(tx: Tx, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await tx.insert(invoice_counters).values({ tenant_id: tenantId, year, last_number: 1 })
    .onConflictDoUpdate({ target: [invoice_counters.tenant_id, invoice_counters.year], set: { last_number: sql`${invoice_counters.last_number} + 1` } })
    .returning({ n: invoice_counters.last_number });
  return `${year}-${String(row.n).padStart(5, "0")}`;
}

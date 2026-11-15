import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { audit_logs, users, tenants } from "@/db/schema";
import { apiRoot } from "@/lib/guard";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const user = await apiRoot();
  if (user instanceof NextResponse) return user;
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 50, 1), 200);
  const rows = await db.select({
    id: audit_logs.id, action: audit_logs.action, entity: audit_logs.entity, entity_id: audit_logs.entity_id, ip: audit_logs.ip, created_at: audit_logs.created_at,
    actor: users.email, tenant: tenants.name,
  }).from(audit_logs).leftJoin(users, eq(audit_logs.actor_id, users.id)).leftJoin(tenants, eq(audit_logs.tenant_id, tenants.id))
    .orderBy(desc(audit_logs.created_at)).limit(limit);
  return NextResponse.json(rows);
}

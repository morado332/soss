import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accountant_links, users } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError } from "@/lib/guard";
import { rateLimit } from "@/lib/ratelimit";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant();
  if (ctx instanceof NextResponse) return ctx;
  const rows = await db.select({ id: accountant_links.id, name: users.name, accountant_id: users.accountant_id, created_at: accountant_links.created_at })
    .from(accountant_links).innerJoin(users, eq(accountant_links.accountant_user_id, users.id))
    .where(and(eq(accountant_links.tenant_id, ctx.tenant.id), eq(accountant_links.status, "active")));
  return NextResponse.json(rows);
}

const Body = z.object({ accountant_id: z.string().trim().toUpperCase().regex(/^ACC-\d{3,10}$/) }).strict();

export async function POST(req: NextRequest) {
  const ctx = await apiTenant(undefined, { ownerOnly: true, write: true });
  if (ctx instanceof NextResponse) return ctx;
  if (!rateLimit(`acclink:${ctx.tenant.id}`, 10, 10 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("ACC_NOT_FOUND", 404);
  const [acc] = await db.select({ id: users.id }).from(users).where(and(eq(users.accountant_id, parsed.data.accountant_id), eq(users.role, "accountant"), eq(users.is_active, true))).limit(1);
  if (!acc) return jsonError("ACC_NOT_FOUND", 404);
  await db.insert(accountant_links).values({ accountant_user_id: acc.id, tenant_id: ctx.tenant.id })
    .onConflictDoUpdate({ target: [accountant_links.accountant_user_id, accountant_links.tenant_id], set: { status: "active" } });
  await audit(ctx.user.id, ctx.tenant.id, "accountant.link", "accountant_link", acc.id, null, { accountant_id: parsed.data.accountant_id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const ctx = await apiTenant(undefined, { ownerOnly: true, write: true });
  if (ctx instanceof NextResponse) return ctx;
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return jsonError("INVALID_INPUT", 400);
  const [row] = await db.update(accountant_links).set({ status: "revoked" }).where(and(eq(accountant_links.id, id.data), eq(accountant_links.tenant_id, ctx.tenant.id))).returning();
  if (!row) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, "accountant.unlink", "accountant_link", row.id);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit, hashPassword } from "@/lib/auth";
import { apiRoot, jsonError } from "@/lib/guard";
import { clientIp, emailSchema, passwordSchema, readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiRoot("platform:accountants");
  if (user instanceof NextResponse) return user;
  const rows = await db.select({
    id: users.id, name: users.name, email: users.email, accountant_id: users.accountant_id, is_active: users.is_active, last_login_at: users.last_login_at,
    clients: sql<number>`(select count(*)::int from accountant_links l where l.accountant_user_id = "users"."id" and l.status = 'active')`,
  }).from(users).where(eq(users.role, "accountant")).orderBy(desc(users.created_at));
  return NextResponse.json(rows);
}

const Body = z.object({ name: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema }).strict();

export async function POST(req: NextRequest) {
  const user = await apiRoot("platform:accountants");
  if (user instanceof NextResponse) return user;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(parsed.error.issues.some((i) => i.path[0] === "password") ? "WEAK_PASSWORD" : "INVALID_INPUT", 400);
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (taken) return jsonError("EMAIL_TAKEN", 409);
  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(814202)`);
    const [{ n }] = (await tx.execute<{ n: number }>(sql`select coalesce(max(substring(accountant_id from 5)::int), 1000)::int as n from users where accountant_id ~ '^ACC-[0-9]+$'`)).rows;
    const accountantId = `ACC-${n + 1}`;
    const [u] = await tx.insert(users).values({
      email: parsed.data.email, name: parsed.data.name, password_hash: await hashPassword(parsed.data.password), role: "accountant", accountant_id: accountantId, permissions: ["invoices:read"],
    }).returning({ id: users.id, accountant_id: users.accountant_id });
    return u;
  });
  await audit(user.id, null, "accountant.create", "user", created.id, null, { email: parsed.data.email, accountant_id: created.accountant_id }, clientIp(req));
  return NextResponse.json({ ok: true, accountant_id: created.accountant_id });
}

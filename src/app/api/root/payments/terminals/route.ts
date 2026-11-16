import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { terminal_readers, tenants } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiRoot, jsonError } from "@/lib/guard";
import { clientIp, readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await apiRoot("platform:payments");
  if (user instanceof NextResponse) return user;
  const tid = z.string().uuid().safeParse(req.nextUrl.searchParams.get("tenant_id"));
  if (!tid.success) return jsonError("INVALID_INPUT", 400);
  return NextResponse.json(await db.select().from(terminal_readers).where(eq(terminal_readers.tenant_id, tid.data)).orderBy(asc(terminal_readers.created_at)));
}

const Body = z.object({
  tenant_id: z.string().uuid(), provider: z.enum(["stripe", "sumup"]), label: z.string().trim().min(2).max(80),
  reader_id: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9_\-]+$/),
}).strict().refine((b) => b.provider !== "stripe" || b.reader_id.startsWith("tmr_"), { path: ["reader_id"] });

export async function POST(req: NextRequest) {
  const user = await apiRoot("platform:payments");
  if (user instanceof NextResponse) return user;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_KEY_FORMAT", 400);
  const [t] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, parsed.data.tenant_id)).limit(1);
  if (!t) return jsonError("NOT_FOUND", 404);
  const [row] = await db.insert(terminal_readers).values(parsed.data).returning();
  await audit(user.id, t.id, "tenant.terminal.add", "terminal_reader", row.id, null, { provider: row.provider, label: row.label }, clientIp(req));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await apiRoot("platform:payments");
  if (user instanceof NextResponse) return user;
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return jsonError("INVALID_INPUT", 400);
  const [row] = await db.delete(terminal_readers).where(and(eq(terminal_readers.id, id.data))).returning();
  if (!row) return jsonError("NOT_FOUND", 404);
  await audit(user.id, row.tenant_id, "tenant.terminal.remove", "terminal_reader", row.id, { label: row.label }, null, clientIp(req));
  return NextResponse.json({ ok: true });
}

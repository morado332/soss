import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { apiTenant, jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

// Mark notifications as read (only the caller's own business).
const Body = z.object({ ids: z.array(z.string().uuid()).max(200).optional(), kind: z.enum(["ai", "other"]).optional() }).strict();

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant();
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const conds = [eq(notifications.tenant_id, ctx.tenant.id), eq(notifications.is_read, false)];
  if (parsed.data.ids?.length) conds.push(inArray(notifications.id, parsed.data.ids));
  if (parsed.data.kind === "ai") conds.push(eq(notifications.type, "ai"));
  if (parsed.data.kind === "other") conds.push(ne(notifications.type, "ai"));
  await db.update(notifications).set({ is_read: true }).where(and(...conds));
  return NextResponse.json({ ok: true });
}

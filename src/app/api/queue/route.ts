import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { queue_tickets } from "@/db/schema";
import { apiTenant, jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await apiTenant("appointments:read", { module: "queue" });
  if (ctx instanceof NextResponse) return ctx;
  const since = new Date(); since.setHours(0, 0, 0, 0);
  return NextResponse.json(await db.select().from(queue_tickets).where(and(eq(queue_tickets.tenant_id, ctx.tenant.id), sql`(${queue_tickets.status} <> 'done' or ${gte(queue_tickets.created_at, since)})`)).orderBy(asc(queue_tickets.number)).limit(100));
}

const Body = z.object({ action: z.enum(["new", "next", "done"]), patient_name: z.string().trim().max(120).optional() }).strict();

// Practice ticket queue: draw a number / call next / finish current
export async function POST(req: NextRequest) {
  const ctx = await apiTenant("appointments:write", { write: true, module: "queue" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const tid = ctx.tenant.id;
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"queue:" + tid}))`);
    if (parsed.data.action === "new") {
      const [{ n }] = await tx.select({ n: sql<number>`coalesce(max(${queue_tickets.number}),0)::int` }).from(queue_tickets).where(eq(queue_tickets.tenant_id, tid));
      const [row] = await tx.insert(queue_tickets).values({ tenant_id: tid, number: n + 1, patient_name: parsed.data.patient_name || null }).returning();
      return row;
    }
    // finish the currently called ticket(s)
    await tx.update(queue_tickets).set({ status: "done" }).where(and(eq(queue_tickets.tenant_id, tid), eq(queue_tickets.status, "called")));
    if (parsed.data.action === "done") return null;
    const [next] = await tx.select().from(queue_tickets).where(and(eq(queue_tickets.tenant_id, tid), eq(queue_tickets.status, "waiting"))).orderBy(asc(queue_tickets.number)).limit(1);
    if (!next) return null;
    await tx.update(queue_tickets).set({ status: "called" }).where(eq(queue_tickets.id, next.id));
    return next;
  });
  return NextResponse.json({ ok: true, ticket: result });
}

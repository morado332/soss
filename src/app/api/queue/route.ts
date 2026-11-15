import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { queue_tickets } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Praxis ticket queue: new ticket / call next
export async function POST(req: NextRequest) {
  const user = await requireUser().catch(() => null);
  if (!user?.tenant_id) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { action, patient_name } = (await req.json().catch(() => ({}))) as { action?: string; patient_name?: string };
  const tid = user.tenant_id;
  if (action === "new") {
    const [{ value: n }] = await db.select({ value: sql<number>`coalesce(max(number),0)::int` }).from(queue_tickets).where(eq(queue_tickets.tenant_id, tid));
    const [row] = await db.insert(queue_tickets).values({ tenant_id: tid, number: n + 1, patient_name: patient_name ?? null }).returning();
    return NextResponse.json({ ok: true, ticket: row });
  }
  if (action === "next") {
    const [next] = await db.select().from(queue_tickets).where(and(eq(queue_tickets.tenant_id, tid), eq(queue_tickets.status, "waiting"))).orderBy(queue_tickets.number).limit(1);
    if (!next) return NextResponse.json({ error: "Keine wartenden Tickets" }, { status: 404 });
    await db.update(queue_tickets).set({ status: "called" }).where(eq(queue_tickets.id, next.id));
    return NextResponse.json({ ok: true, ticket: next });
  }
  if (action === "done") {
    const [called] = await db.select().from(queue_tickets).where(and(eq(queue_tickets.tenant_id, tid), eq(queue_tickets.status, "called"))).orderBy(desc(queue_tickets.number)).limit(1);
    if (called) await db.update(queue_tickets).set({ status: "done" }).where(eq(queue_tickets.id, called.id));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "action new|next|done" }, { status: 400 });
}

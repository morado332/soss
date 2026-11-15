import { NextResponse } from "next/server";
import { db } from "@/db";
import { audit_logs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user || (user.role !== "root" && user.role !== "super_admin")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json(await db.select().from(audit_logs).orderBy(audit_logs.created_at).limit(20));
}

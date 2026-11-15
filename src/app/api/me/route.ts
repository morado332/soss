import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ id: u.id, email: u.email, name: u.name, role: u.role, tenant_id: u.tenant_id, accountant_id: u.accountant_id, permissions: u.permissions });
}

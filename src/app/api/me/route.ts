import { NextResponse } from "next/server";
import { apiUser } from "@/lib/guard";
import { publicUser } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const u = await apiUser();
  if (u instanceof NextResponse) return u;
  return NextResponse.json(publicUser(u));
}

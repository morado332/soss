import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/diagnostics";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await checkHealth();
  return NextResponse.json({ ok: h.code === "OK", code: h.code, detail: h.detail ?? null }, { status: h.code === "OK" ? 200 : 503 });
}

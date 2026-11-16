import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { processReminders } from "@/core/reminders";

export const dynamic = "force-dynamic";

// Called by a scheduler (system cron on the server, or Vercel Cron) with: Authorization: Bearer <CRON_SECRET>
function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = createHash("sha256").update(req.headers.get("authorization") ?? "").digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(given, expected);
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const processed = await processReminders();
  return NextResponse.json({ ok: true, processed });
}
export const GET = run;
export const POST = run;

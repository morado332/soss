import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, audit } from "@/lib/auth";
import { ensureSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  await ensureSeed();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
  if (!user || !user.is_active) return NextResponse.json({ error: "Zugangsdaten falsch oder Konto gesperrt" }, { status: 401 });
  if (!(await verifyPassword(parsed.data.password, user.password_hash))) {
    return NextResponse.json({ error: "Zugangsdaten falsch" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for") ?? undefined;
  const ua = req.headers.get("user-agent") ?? undefined;
  await createSession(user.id, ip, ua);
  await db.update(users).set({ last_login_at: new Date() }).where(eq(users.id, user.id));
  await audit(user.id, user.tenant_id, "login", "user", user.id, null, { email: user.email }, ip);
  return NextResponse.json({ ok: true, role: user.role, name: user.name, tenant_id: user.tenant_id });
}

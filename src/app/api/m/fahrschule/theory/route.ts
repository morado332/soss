import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { tenants, fs_students } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiTenant, jsonError, type Tenant } from "@/lib/guard";
import { rateLimit } from "@/lib/ratelimit";
import { readJson } from "@/lib/security";
import { fetchTheoryProgress, validateTheoryUrl } from "@/modules/fahrschule/service";

export const dynamic = "force-dynamic";

type TheoryCfg = { url?: string; key?: string };
const cfgOf = (t: Tenant): TheoryCfg => ((t.settings as Record<string, unknown> | null)?.fs_theory as TheoryCfg) ?? {};

export async function GET() {
  const ctx = await apiTenant("appointments:read", { module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const cfg = cfgOf(ctx.tenant);
  const students = await db.select({ id: fs_students.id, name: fs_students.name, theory_progress: fs_students.theory_progress, theory_passed: fs_students.theory_passed, theory_external_id: fs_students.theory_external_id, theory_synced_at: fs_students.theory_synced_at })
    .from(fs_students).where(and(eq(fs_students.tenant_id, ctx.tenant.id), ne(fs_students.status, "finished")));
  // The API key is never sent back to the browser.
  return NextResponse.json({ url: cfg.url ?? "", hasKey: !!cfg.key, students });
}

export async function PATCH(req: NextRequest) {
  const ctx = await apiTenant("fahrschule:manage", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ url: z.string().trim().max(300), key: z.string().trim().max(500).optional() }).strict().safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  let url = "";
  if (parsed.data.url) {
    const ok = await validateTheoryUrl(parsed.data.url);
    if (!ok) return jsonError("FS_BAD_THEORY_URL", 400);
    url = ok;
  }
  const old = cfgOf(ctx.tenant);
  const next: TheoryCfg = { url, key: parsed.data.key ? parsed.data.key : old.key };
  const settings = { ...((ctx.tenant.settings as Record<string, unknown> | null) ?? {}), fs_theory: next };
  await db.update(tenants).set({ settings, updated_at: new Date() }).where(eq(tenants.id, ctx.tenant.id));
  await audit(ctx.user.id, ctx.tenant.id, "fs.theory.config", "tenant", ctx.tenant.id, { url: old.url ?? "" }, { url, key: parsed.data.key ? "changed" : "unchanged" });
  return NextResponse.json({ ok: true });
}

// Pulls progress for every student that has an ID on the theory platform.
export async function POST() {
  const ctx = await apiTenant("fahrschule:manage", { write: true, module: "fahrschule" });
  if (ctx instanceof NextResponse) return ctx;
  if (!rateLimit(`fs-theory:${ctx.tenant.id}`, 10, 10 * 60_000).ok) return jsonError("RATE_LIMITED", 429);
  const cfg = cfgOf(ctx.tenant);
  if (!cfg.url) return jsonError("FS_THEORY_NOT_SET", 400);
  const list = await db.select({ id: fs_students.id, ext: fs_students.theory_external_id }).from(fs_students)
    .where(and(eq(fs_students.tenant_id, ctx.tenant.id), isNotNull(fs_students.theory_external_id), ne(fs_students.status, "finished"))).limit(500);
  let updated = 0, failed = 0;
  for (const s of list) {
    if (!s.ext) continue;
    const p = await fetchTheoryProgress(cfg.url, cfg.key, s.ext);
    if (!p) { failed++; continue; }
    await db.update(fs_students).set({ theory_progress: p.progress, theory_passed: p.passed, theory_synced_at: new Date() })
      .where(and(eq(fs_students.id, s.id), eq(fs_students.tenant_id, ctx.tenant.id)));
    updated++;
  }
  return NextResponse.json({ ok: true, updated, failed });
}

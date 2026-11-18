import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { biz_records } from "@/db/schema";
import { audit } from "@/lib/auth";
import { jsonError } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { isKind, kindDef, type KindDef } from "@/modules/business/kinds";
import { checkRefs, nextNo, resolveRefs, searchText, validateRecord } from "@/modules/business/validate";
import { apiBiz } from "@/modules/business/access";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ kind: string }> };

async function resolve(params: Ctx["params"]): Promise<KindDef | null> {
  const { kind } = await params;
  return isKind(kind) ? kindDef(kind) : null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const def = await resolve(params);
  if (!def) return jsonError("NOT_FOUND", 404);
  const ctx = await apiBiz(def.read, def.modules);
  if (ctx instanceof NextResponse) return ctx;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase().slice(0, 100).replace(/[%_\\]/g, "\\$&");
  const rows = await db.select({ id: biz_records.id, data: biz_records.data, created_at: biz_records.created_at }).from(biz_records)
    .where(and(eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, def.key), q ? ilike(biz_records.search, `%${q}%`) : undefined))
    .orderBy(desc(biz_records.created_at)).limit(1000);
  if (req.nextUrl.searchParams.get("lite")) {
    return NextResponse.json(rows.map((r) => { const d = r.data as Record<string, unknown>; return { id: r.id, title: String(d[def.title] ?? (d.no ? `#${d.no}` : "")) }; }));
  }
  return NextResponse.json({ rows, refs: await resolveRefs(def, rows, ctx.tenant.id) });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const def = await resolve(params);
  if (!def) return jsonError("NOT_FOUND", 404);
  const ctx = await apiBiz(def.write, def.modules, true);
  if (ctx instanceof NextResponse) return ctx;
  const v = validateRecord(def, await readJson(req));
  if (!v.ok) return jsonError("INVALID_INPUT", 400, { field: v.field });
  const badRef = await checkRefs(def, v.data, ctx.tenant.id);
  if (badRef) return jsonError("NOT_FOUND", 404, { field: badRef });
  const row = await db.transaction(async (tx) => {
    const data = def.autoNo ? { ...v.data, no: await nextNo(tx, ctx.tenant.id, def.key) } : v.data;
    const [r] = await tx.insert(biz_records).values({ tenant_id: ctx.tenant.id, kind: def.key, data, search: searchText(def, data) + (def.autoNo ? ` ${def.autoNo}-${data.no}`.toLowerCase() : ""), created_by: ctx.user.id }).returning();
    return r;
  });
  await audit(ctx.user.id, ctx.tenant.id, `biz.${def.key}.create`, "biz_record", row.id);
  return NextResponse.json({ ok: true, row });
}

const Patch = z.object({ id: z.string().uuid(), data: z.record(z.string(), z.unknown()) }).strict();

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const def = await resolve(params);
  if (!def) return jsonError("NOT_FOUND", 404);
  const ctx = await apiBiz(def.write, def.modules, true);
  if (ctx instanceof NextResponse) return ctx;
  const p = Patch.safeParse(await readJson(req));
  if (!p.success) return jsonError("INVALID_INPUT", 400);
  const where = and(eq(biz_records.id, p.data.id), eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, def.key));
  const [old] = await db.select().from(biz_records).where(where).limit(1);
  if (!old) return jsonError("NOT_FOUND", 404);
  const { no, ...prev } = old.data as Record<string, unknown>;
  const v = validateRecord(def, { ...prev, ...p.data.data });
  if (!v.ok) return jsonError("INVALID_INPUT", 400, { field: v.field });
  const badRef = await checkRefs(def, v.data, ctx.tenant.id);
  if (badRef) return jsonError("NOT_FOUND", 404, { field: badRef });
  const data = no !== undefined ? { ...v.data, no } : v.data;
  await db.update(biz_records).set({ data, search: searchText(def, data) + (def.autoNo && no ? ` ${def.autoNo}-${no}`.toLowerCase() : ""), updated_at: new Date() }).where(where);
  await audit(ctx.user.id, ctx.tenant.id, `biz.${def.key}.update`, "biz_record", old.id, old.data, data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const def = await resolve(params);
  if (!def) return jsonError("NOT_FOUND", 404);
  const ctx = await apiBiz(def.write, def.modules, true);
  if (ctx instanceof NextResponse) return ctx;
  const id = z.string().uuid().safeParse(req.nextUrl.searchParams.get("id"));
  if (!id.success) return jsonError("INVALID_INPUT", 400);
  const [old] = await db.delete(biz_records).where(and(eq(biz_records.id, id.data), eq(biz_records.tenant_id, ctx.tenant.id), eq(biz_records.kind, def.key))).returning();
  if (!old) return jsonError("NOT_FOUND", 404);
  await audit(ctx.user.id, ctx.tenant.id, `biz.${def.key}.delete`, "biz_record", old.id, old.data, null);
  return NextResponse.json({ ok: true });
}

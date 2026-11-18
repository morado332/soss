import "server-only";
import { z, type ZodTypeAny } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { biz_records, products, users } from "@/db/schema";
import type { Field, KindDef } from "./kinds";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
function fieldSchema(f: Field): ZodTypeAny {
  switch (f.type) {
    case "text": return z.string().trim().max(200);
    case "textarea": return z.string().trim().max(4000);
    case "int": return z.number().int().min(-1_000_000).max(100_000_000);
    case "decimal": return z.number().finite().min(-1e9).max(1e9);
    case "money": return z.number().int().min(-1e11).max(1e11);
    case "percent": return z.number().finite().min(0).max(100);
    case "date": return date;
    case "datetime": return z.string().datetime({ offset: true });
    case "select": return z.enum(f.options as [string, ...string[]]);
    case "phone": return z.string().trim().max(40).regex(/^[0-9+()\/\-\s]*$/);
    case "email": return z.string().trim().max(254).email().or(z.literal(""));
    case "bool": return z.boolean();
    case "ref": case "product": case "staff": return z.string().uuid().or(z.literal(""));
  }
}

/** Validates a full record against the kind's fields; unknown keys are rejected, empty optional values dropped. */
export function validateRecord(def: KindDef, input: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; field: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, field: "" };
  const src = input as Record<string, unknown>;
  for (const k of Object.keys(src)) if (!def.fields.some((f) => f.key === k)) return { ok: false, field: k };
  const out: Record<string, unknown> = {};
  for (const f of def.fields) {
    let v = src[f.key];
    if (v === undefined || v === null || v === "") v = f.default;
    if (v === undefined || v === null || v === "") { if (f.required) return { ok: false, field: f.key }; continue; }
    const r = fieldSchema(f).safeParse(v);
    if (!r.success) return { ok: false, field: f.key };
    if (r.data !== "") out[f.key] = r.data;
    else if (f.required) return { ok: false, field: f.key };
  }
  return { ok: true, data: out };
}

/** Every reference must point to a row of the same business (no cross-tenant links). */
export async function checkRefs(def: KindDef, data: Record<string, unknown>, tenantId: string): Promise<string | null> {
  for (const f of def.fields) {
    const v = data[f.key];
    if (typeof v !== "string" || !v) continue;
    let found = false;
    if (f.type === "ref") found = (await db.select({ id: biz_records.id }).from(biz_records).where(and(eq(biz_records.id, v), eq(biz_records.tenant_id, tenantId), eq(biz_records.kind, f.ref!))).limit(1)).length > 0;
    else if (f.type === "product") found = (await db.select({ id: products.id }).from(products).where(and(eq(products.id, v), eq(products.tenant_id, tenantId))).limit(1)).length > 0;
    else if (f.type === "staff") found = (await db.select({ id: users.id }).from(users).where(and(eq(users.id, v), eq(users.tenant_id, tenantId))).limit(1)).length > 0;
    else continue;
    if (!found) return f.key;
  }
  return null;
}

export const searchText = (def: KindDef, data: Record<string, unknown>) =>
  def.fields.filter((f) => f.search || f.key === def.title).map((f) => data[f.key]).filter((v) => typeof v === "string").join(" ").toLowerCase().slice(0, 2000);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Next sequential number per tenant & kind (race-safe via advisory lock). */
export async function nextNo(tx: Tx, tenantId: string, kind: string): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${tenantId + ":" + kind}))`);
  const r = await tx.execute<{ n: number }>(sql`select coalesce(max((data->>'no')::int), 0)::int + 1 as n from biz_records where tenant_id = ${tenantId} and kind = ${kind} and data ? 'no'`);
  return Number(r.rows[0]?.n ?? 1);
}

/** Display titles of referenced rows, for list views. */
export async function resolveRefs(def: KindDef, rows: { data: unknown }[], tenantId: string) {
  const refs: Record<string, Record<string, string>> = {};
  for (const f of def.fields) {
    if (f.type !== "ref" && f.type !== "product" && f.type !== "staff") continue;
    const ids = [...new Set(rows.map((r) => (r.data as Record<string, unknown>)[f.key]).filter((v): v is string => typeof v === "string" && !!v))];
    refs[f.key] = {};
    if (!ids.length) continue;
    if (f.type === "product") for (const p of await db.select({ id: products.id, t: products.name }).from(products).where(and(eq(products.tenant_id, tenantId), inArray(products.id, ids)))) refs[f.key][p.id] = p.t;
    else if (f.type === "staff") for (const u of await db.select({ id: users.id, t: users.name }).from(users).where(and(eq(users.tenant_id, tenantId), inArray(users.id, ids)))) refs[f.key][u.id] = u.t;
    else {
      const { KINDS } = await import("./kinds");
      const rd = KINDS[f.ref as keyof typeof KINDS] as unknown as KindDef;
      for (const r of await db.select({ id: biz_records.id, data: biz_records.data }).from(biz_records).where(and(eq(biz_records.tenant_id, tenantId), eq(biz_records.kind, f.ref!), inArray(biz_records.id, ids)))) {
        const d = r.data as Record<string, unknown>;
        refs[f.key][r.id] = String(d[rd.title] ?? (d.no ? `#${d.no}` : r.id.slice(0, 8)));
      }
    }
  }
  return refs;
}

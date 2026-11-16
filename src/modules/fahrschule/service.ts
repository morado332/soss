import "server-only";
import dns from "node:dns/promises";
import net from "node:net";
import { and, eq, gt, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { fs_lessons } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const LESSON_TYPES = ["normal", "ueberland", "autobahn", "nacht", "exam"] as const;
export type LessonType = (typeof LESSON_TYPES)[number];
export const UNIT_MINUTES = 45;

/**
 * Checks instructor / vehicle / student availability inside a per-tenant advisory lock
 * (so two parallel bookings can't both pass). Returns an error code or null.
 */
export async function lessonConflict(tx: Tx, tenantId: string, l: { starts: Date; ends: Date; instructor_id: string; vehicle_id?: string | null; student_id: string; excludeId?: string }) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"fs:" + tenantId}))`);
  const base = [eq(fs_lessons.tenant_id, tenantId), lt(fs_lessons.starts_at, l.ends), gt(fs_lessons.ends_at, l.starts), notInArray(fs_lessons.status, ["cancelled", "no_show"])];
  if (l.excludeId) base.push(ne(fs_lessons.id, l.excludeId));
  const hit = async (cond: ReturnType<typeof eq>) => (await tx.select({ id: fs_lessons.id }).from(fs_lessons).where(and(...base, cond)).limit(1)).length > 0;
  if (await hit(eq(fs_lessons.instructor_id, l.instructor_id))) return "FS_INSTRUCTOR_BUSY";
  if (l.vehicle_id && (await hit(eq(fs_lessons.vehicle_id, l.vehicle_id)))) return "FS_VEHICLE_BUSY";
  if (await hit(eq(fs_lessons.student_id, l.student_id))) return "FS_STUDENT_BUSY";
  return null;
}

// ---------------------------------------------------------------- theory platform (SSRF-safe)

function privateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

/** Only public https URLs; rejects hosts that resolve to private / loopback / link-local addresses. */
export async function validateTheoryUrl(raw: string): Promise<string | null> {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password || !u.hostname || u.hostname === "localhost") return null;
  if (net.isIP(u.hostname)) return privateIp(u.hostname) ? null : u.toString().replace(/\/+$/, "");
  try {
    const addrs = await dns.lookup(u.hostname, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  } catch { return null; }
  return u.toString().replace(/\/+$/, "");
}

/** Fetches one student's progress: GET {base}/students/{id} → { progress: 0–100, passed?: boolean }. */
export async function fetchTheoryProgress(base: string, key: string | undefined, externalId: string): Promise<{ progress: number; passed: boolean } | null> {
  const safeBase = await validateTheoryUrl(base);
  if (!safeBase) return null;
  try {
    const r = await fetch(`${safeBase}/students/${encodeURIComponent(externalId)}`, {
      headers: { Accept: "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const text = await r.text();
    if (text.length > 64 * 1024) return null;
    const j = JSON.parse(text) as { progress?: unknown; passed?: unknown };
    const p = Number(j.progress);
    if (!Number.isFinite(p)) return null;
    return { progress: Math.max(0, Math.min(100, Math.round(p))), passed: j.passed === true };
  } catch {
    return null;
  }
}

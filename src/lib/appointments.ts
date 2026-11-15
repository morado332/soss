import "server-only";
import { and, eq, gt, lt, notInArray, sql } from "drizzle-orm";
import { appointments } from "@/db/schema";
import { db } from "@/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Serialize bookings per tenant and check for overlaps (cancelled / no-show slots are free again). */
export async function hasConflict(tx: Tx, tenantId: string, starts: Date, ends: Date, excludeId?: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"appt:" + tenantId}))`);
  const conds = [eq(appointments.tenant_id, tenantId), lt(appointments.starts_at, ends), gt(appointments.ends_at, starts), notInArray(appointments.status, ["cancelled", "no_show"])];
  if (excludeId) conds.push(sql`${appointments.id} <> ${excludeId}`);
  const clash = await tx.select({ id: appointments.id }).from(appointments).where(and(...conds)).limit(1);
  return clash.length > 0;
}

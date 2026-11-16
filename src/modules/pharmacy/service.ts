import "server-only";
import type { Tenant } from "@/lib/guard";

/** Reservation fee (cents) configured by the pharmacy itself; 0 = free reservation. Max 50 €. */
export function reservationFee(t: Pick<Tenant, "settings">): number {
  const s = (t.settings ?? {}) as Record<string, unknown>;
  const n = Number(s.pharmacy_fee_cents ?? 0);
  return Number.isInteger(n) && n >= 0 && n <= 5000 ? n : 0;
}
export function pickupHours(t: Pick<Tenant, "settings">): number {
  const n = Number(((t.settings ?? {}) as Record<string, unknown>).pharmacy_hold_hours ?? 48);
  return Number.isInteger(n) && n >= 1 && n <= 336 ? n : 48;
}
export type ReservationItem = { product_id: string; name: string; qty: number; price_cents: number; rx: boolean };
export const RES_STATUS = ["reserved", "ready", "picked_up", "cancelled"] as const;

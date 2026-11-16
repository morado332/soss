import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CheckCircle2, Clock, Pill } from "lucide-react";
import { db } from "@/db";
import { orders, tenants } from "@/db/schema";
import { getI18n } from "@/lib/i18n-server";
import type { DictKey } from "@/lib/i18n";
import type { ReservationItem } from "@/modules/pharmacy/service";
import "@/components/bio.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

// Reservation status for the customer (link holder). The order id is a random UUID; no personal data is shown.
export default async function Reservation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db.select({ o: orders, name: tenants.name }).from(orders).innerJoin(tenants, eq(orders.tenant_id, tenants.id)).where(eq(orders.id, id)).limit(1);
  if (!row || row.o.source !== "reservation") notFound();
  const { t, locale } = await getI18n();
  const o = row.o;
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency: "EUR" });
  return (
    <main className="bio flex min-h-dvh items-center justify-center p-4" data-theme="glass">
      <div className="bio-blob b1" /><div className="bio-blob b2" /><div className="bio-blob b3" />
      <div className="bio-glass w-full max-w-md space-y-4 rounded-[36px] p-7">
        <p className="flex items-center gap-2 text-lg font-bold"><Pill className="h-5 w-5" />{row.name}</p>
        <div className="bio-btn rounded-2xl p-4 text-center">
          <p className="bio-muted text-xs">{t("ph_pickupCode")}</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em]">{o.pickup_code}</p>
        </div>
        <ul className="space-y-1 text-sm">{((o.items ?? []) as ReservationItem[]).map((i, k) => <li key={k} className="flex justify-between"><span>{i.qty}× {i.name}{i.rx ? " (Rx)" : ""}</span><span className="bio-muted">{money(i.qty * i.price_cents)}</span></li>)}</ul>
        <p className="flex items-center gap-2 text-sm">{o.status === "ready" ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}{t(`ph_st_${o.status}` as DictKey)}</p>
        {o.reservation_fee_cents > 0 && <p className="text-sm">{t("ph_fee")}: {money(o.reservation_fee_cents)} · {t(`ph_pay_${o.payment_status}` as DictKey)}</p>}
        {o.requires_prescription && <p className="bio-muted text-xs">{t("ph_bringRx")}</p>}
      </div>
    </main>
  );
}

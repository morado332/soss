import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { and, asc, eq, inArray } from "drizzle-orm";
import { CalendarX } from "lucide-react";
import { db } from "@/db";
import { tenants, services } from "@/db/schema";
import { getI18n, getTheme } from "@/lib/i18n-server";
import { professionByKey, professionName } from "@/lib/professions";
import { LanguageSwitcher, ThemeToggle } from "@/components/providers";
import {} from "@/components/ui";
import BookingForm from "./booking-form";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  const [t] = await db.select({ id: tenants.id, name: tenants.name, profession: tenants.profession }).from(tenants)
    .where(and(eq(tenants.slug, slug), inArray(tenants.status, ["active", "trial", "past_due"]))).limit(1);
  if (!t) return null;
  const svcs = await db.select({ id: services.id, name: services.name, duration_minutes: services.duration_minutes, price_cents: services.price_cents })
    .from(services).where(and(eq(services.tenant_id, t.id), eq(services.is_active, true))).orderBy(asc(services.name));
  return { ...t, services: svcs };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug);
  return { title: data ? data.name : "Booking", robots: { index: !!data } };
}

export default async function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await load(slug);
  const { t, lang } = await getI18n();
  const theme = await getTheme();
  const prof = data ? professionByKey(data.profession) : null;
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/60 to-slate-50 dark:from-slate-900 dark:to-slate-950">
      <div className="mx-auto flex max-w-xl items-center justify-end gap-2 px-4 pt-6"><LanguageSwitcher /><ThemeToggle initial={theme} /></div>
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          {!data || !prof ? (
            <div className="p-10 text-center"><CalendarX className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-4 text-sm text-slate-500">{t("b_notFound")}</p></div>
          ) : (
            <>
              <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-6 dark:border-slate-800 dark:bg-slate-800/30">
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">{t("b_badge")}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-2xl shadow-sm dark:bg-slate-900">{prof.icon}</span>
                  <div><h1 className="text-xl font-semibold tracking-tight">{data.name}</h1><p className="text-sm text-slate-500">{professionName(prof, lang)}</p></div>
                </div>
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{t("b_sub")}</p>
              </div>
              <BookingForm slug={slug} business={data.name} services={data.services} />
            </>
          )}
        </div>
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"><Logo className="scale-75" />{t("poweredBy")}</p>
      </main>
    </div>
  );
}

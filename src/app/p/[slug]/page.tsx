import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { profiles, tenants } from "@/db/schema";
import { getI18n } from "@/lib/i18n-server";
import { tenantModules } from "@/lib/guard";
import { getBranding } from "@/core/platform";
import { BioCard, type BioLink } from "@/components/bio-card";
import { PharmacyReserve } from "./pharmacy-reserve";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const [row] = await db.select({ p: profiles, t: tenants }).from(profiles).leftJoin(tenants, eq(profiles.tenant_id, tenants.id))
    .where(and(eq(profiles.slug, slug), eq(profiles.published, true))).limit(1);
  if (!row) return null;
  if (row.t && !["active", "trial", "past_due"].includes(row.t.status)) return null;
  return row;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const row = await load((await params).slug);
  if (!row) return { title: "404" };
  return { title: row.p.display_name, description: row.p.headline || row.p.bio?.slice(0, 150) || undefined };
}

export default async function PublicProfile({ params }: { params: Promise<{ slug: string }> }) {
  const row = await load((await params).slug);
  if (!row) notFound();
  const { p, t: tenant } = row;
  const { t } = await getI18n();
  const mods = tenant ? await tenantModules(tenant) : new Set<string>();
  await db.update(profiles).set({ views: sql`${profiles.views} + 1` }).where(eq(profiles.id, p.id));
  const branding = await getBranding();
  const booking = tenant && p.show_booking && mods.has("appointments") ? `/book/${tenant.slug}` : null;
  const pharmacy = tenant && p.show_pharmacy && mods.has("pharmacy");
  return (
    <main>
      <BioCard p={{ ...p, links: (p.links ?? []) as BioLink[] }} booking={booking}
        labels={{ call: t("bio_call"), whatsapp: "WhatsApp", email: t("email"), website: t("bio_website"), address: t("bio_address"), book: t("bio_book"), bookSub: tenant?.name ?? t("bio_bookSub") }}
        footer={<Link href="/" className="hover:underline">{branding.siteName}</Link>}>
        {pharmacy && tenant && <PharmacyReserve slug={tenant.slug} />}
      </BioCard>
    </main>
  );
}

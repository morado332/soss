import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { profiles, tenants } from "@/db/schema";
import { audit } from "@/lib/auth";
import { apiUser, jsonError, tenantModules } from "@/lib/guard";
import { readJson } from "@/lib/security";
import { validateImageDataUrl } from "@/lib/images";
import { ProfileBody } from "@/core/profiles";

export const dynamic = "force-dynamic";

async function capabilities(tenantId: string | null) {
  if (!tenantId) return { booking: false, pharmacy: false, tenantSlug: null as string | null };
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!t) return { booking: false, pharmacy: false, tenantSlug: null };
  const mods = await tenantModules(t);
  return { booking: mods.has("appointments"), pharmacy: mods.has("pharmacy"), tenantSlug: t.slug };
}

// Every user has at most ONE public profile (unique user_id).
export async function GET() {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  const [p] = await db.select().from(profiles).where(eq(profiles.user_id, user.id)).limit(1);
  return NextResponse.json({ profile: p ?? null, capabilities: await capabilities(user.tenant_id), suggestion: { display_name: user.name, email: user.email } });
}

export async function PUT(req: NextRequest) {
  const user = await apiUser();
  if (user instanceof NextResponse) return user;
  const parsed = ProfileBody.safeParse(await readJson(req));
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "");
    return jsonError(field === "slug" ? "BAD_SLUG" : field === "links" || field === "website" ? "BAD_URL" : "INVALID_INPUT", 400, { field });
  }
  const d = parsed.data;
  let avatar = d.avatar ?? null;
  if (avatar) { avatar = validateImageDataUrl(avatar); if (!avatar) return jsonError("BAD_IMAGE", 400); }
  const caps = await capabilities(user.tenant_id);
  const [taken] = await db.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.slug, d.slug), ne(profiles.user_id, user.id))).limit(1);
  if (taken) return jsonError("SLUG_TAKEN", 409);
  const values = {
    ...d, avatar, tenant_id: user.tenant_id ?? null, user_id: user.id, updated_at: new Date(),
    // features only if the business really has them
    show_booking: d.show_booking && caps.booking, show_pharmacy: d.show_pharmacy && caps.pharmacy,
  };
  await db.insert(profiles).values(values).onConflictDoUpdate({ target: profiles.user_id, set: values });
  await audit(user.id, user.tenant_id, "profile.update", "profile", user.id, null, { slug: d.slug, published: d.published });
  return NextResponse.json({ ok: true, url: `/p/${d.slug}` });
}

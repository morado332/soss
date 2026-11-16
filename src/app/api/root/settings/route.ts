import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/auth";
import { apiRoot, jsonError } from "@/lib/guard";
import { clientIp, readJson } from "@/lib/security";
import { validateImageDataUrl } from "@/lib/images";
import { getBranding, setSetting } from "@/core/platform";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiRoot("platform:settings");
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await getBranding());
}

const text = (max: number) => z.string().trim().max(max);
const Body = z.object({
  siteName: text(40).min(2).optional(), tagline: text(300).optional(),
  logo: z.string().max(450_000).nullable().optional(), // data URL or null to remove
  accent: z.enum(["indigo", "violet", "emerald", "sky", "rose", "amber", "slate"]).optional(),
  contactEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  contactPhone: text(40).regex(/^[0-9+()\/\-\s]*$/).optional(), address: text(200).optional(), footer: text(300).optional(),
  showIndustries: z.boolean().optional(), showModules: z.boolean().optional(), showCompliance: z.boolean().optional(), showPricing: z.boolean().optional(),
  plans: z.array(z.object({ name: text(30).min(1), price: z.number().min(0).max(10_000) })).min(1).max(6).optional(),
}).strict();

export async function PATCH(req: NextRequest) {
  const user = await apiRoot("platform:settings");
  if (user instanceof NextResponse) return user;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("INVALID_INPUT", 400);
  const d = parsed.data;
  if (d.logo) {
    const ok = validateImageDataUrl(d.logo);
    if (!ok) return jsonError("BAD_IMAGE", 400);
    d.logo = ok;
  }
  const current = await getBranding();
  const next = { ...current, ...d };
  await setSetting("branding", next);
  await audit(user.id, null, "platform.settings.update", "platform", undefined, null, { ...d, logo: d.logo === undefined ? undefined : d.logo ? "updated" : "removed" }, clientIp(req));
  return NextResponse.json({ ok: true });
}

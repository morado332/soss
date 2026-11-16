import "server-only";
import { z } from "zod";

export const THEMES = ["glass", "white", "purple", "green", "dark", "ocean", "sunset", "rose"] as const;
export const LINK_KINDS = ["website", "instagram", "facebook", "tiktok", "youtube", "x", "linkedin", "telegram", "maps", "custom"] as const;

/** Only absolute http(s) URLs are accepted in profile links (blocks javascript:, data:, etc.). */
export const safeUrl = z.string().trim().max(500).refine((v) => {
  try { const u = new URL(v); return (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname && !u.username && !u.password; } catch { return false; }
}, "url");

const RESERVED = new Set(["admin", "root", "api", "login", "setup", "dashboard", "book", "status", "p", "profile", "settings", "arena", "support", "help"]);
export const slugSchema = z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/).refine((s) => !RESERVED.has(s), "reserved");

export const ProfileBody = z.object({
  slug: slugSchema,
  display_name: z.string().trim().min(2).max(80),
  headline: z.string().trim().max(120).optional().default(""),
  bio: z.string().trim().max(600).optional().default(""),
  avatar: z.string().max(450_000).nullable().optional(),
  theme: z.enum(THEMES),
  links: z.array(z.object({ kind: z.enum(LINK_KINDS), label: z.string().trim().min(1).max(40), url: safeUrl })).max(12),
  phone: z.string().trim().max(40).regex(/^[0-9+()\/\-\s]*$/).optional().default(""),
  whatsapp: z.string().trim().max(40).regex(/^[0-9+\s]*$/).optional().default(""),
  email: z.string().trim().max(254).email().optional().or(z.literal("")).default(""),
  website: safeUrl.optional().or(z.literal("")).default(""),
  address: z.string().trim().max(200).optional().default(""),
  show_booking: z.boolean().default(false),
  show_pharmacy: z.boolean().default(false),
  published: z.boolean().default(false),
}).strict();

// Granular RBAC permissions for tenant staff. Owners have "*".
export const PERMISSIONS = [
  "pos:use",
  "products:write",
  "appointments:read",
  "appointments:write",
  "invoices:read",
  "invoices:write",
  "reports:read",
  "settings:write",
  "fahrschule:manage", // students, instructors, vehicles, theory settings
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_PRESETS: Record<string, Permission[]> = {
  cashier: ["pos:use", "appointments:read"],
  reception: ["appointments:read", "appointments:write"],
  manager: ["pos:use", "products:write", "appointments:read", "appointments:write", "invoices:read", "invoices:write", "reports:read", "fahrschule:manage"],
};

// Platform staff (Super Admin) permissions — granted per person by the Root.
export const PLATFORM_PERMISSIONS = [
  "platform:tenants",     // view/create/edit businesses, owners, modules
  "platform:finance",     // revenue, commissions, plans & prices
  "platform:payments",    // Stripe/SumUp configuration, terminals
  "platform:accountants", // accountant accounts
  "platform:audit",       // audit log
  "platform:settings",    // site name, logo, landing page
] as const;
export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

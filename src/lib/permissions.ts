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

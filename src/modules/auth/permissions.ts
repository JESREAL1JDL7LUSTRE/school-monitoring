export const permissions = [
  "personnel.read", "personnel.write", "files.read", "files.write",
  "inventory.read", "inventory.write", "settings.read", "settings.write", "audit.read",
  "calendar.read", "calendar.write", "super_admin.read",
] as const;

export type Permission = (typeof permissions)[number];

export const roleLabels = {
  admin: "Administrator",
  school_head: "School head",
  administrative_officer: "Administrative officer",
  property_custodian: "Property custodian",
  auditor: "Viewer / auditor",
} as const;

export type Role = keyof typeof roleLabels;

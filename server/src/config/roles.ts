// Roles don't split up access: every staff account can do everything in the
// admin. The values are stored anyway (the seeded owner is super_admin, people
// added from Settings are staff) so a split could be introduced later.
export const ROLES = ['super_admin', 'manager', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const STAFF_ROLES: Role[] = [...ROLES];

export function isStaffRole(role: string | undefined): boolean {
  return !!role && STAFF_ROLES.includes(role as Role);
}

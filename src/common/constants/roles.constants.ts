export const ROLES = {
  DIRECTOR: 'director',
  MENTOR: 'mentor',
  FIELD_MENTOR: 'field mentor',
  PASTOR: 'pastor',
  PENDING: 'pending',
} as const;

export const ROLE_HIERARCHY = [
  ROLES.PENDING,
  ROLES.PASTOR,
  ROLES.MENTOR,
  ROLES.FIELD_MENTOR,
  ROLES.DIRECTOR,
] as const;

export function hasRolePermission(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole as any);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole as any);
  return userLevel >= requiredLevel;
}

export type Role = typeof ROLES[keyof typeof ROLES];

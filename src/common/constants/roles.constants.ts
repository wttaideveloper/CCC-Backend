export const ROLES = {
  SUPER_ADMIN: 'super admin',
  DIRECTOR: 'director',
  MENTOR: 'mentor',
  FIELD_MENTOR: 'field mentor',
  PASTOR: 'pastor',
  LAY_LEADER: 'lay leader',
  SEMINARIAN: 'seminarian',
  PENDING: 'pending',
} as const;

export const ROLE_HIERARCHY = [
  ROLES.PENDING,
  ROLES.PASTOR,
  ROLES.MENTOR,
  ROLES.FIELD_MENTOR,
  ROLES.LAY_LEADER,
  ROLES.SEMINARIAN,
  ROLES.DIRECTOR,
  ROLES.SUPER_ADMIN,
] as const;

export function hasRolePermission(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole as any);
  const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole as any);
  return userLevel >= requiredLevel;
}

export type Role = typeof ROLES[keyof typeof ROLES];

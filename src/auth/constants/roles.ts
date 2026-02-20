/**
 * Central role definitions for RBAC.
 * - USER: Consumer (car buyer) – search, chatbot, click, leads
 * - DEALER_USER: Dealer staff – upload/edit listings, mark sold
 * - DEALER_ADMIN: Dealer admin – API, budget, clicks/leads, manage dealer users
 * - ADMIN: Platform admin – verify dealers, approve/reject, suspend, analytics
 * - SUPERADMIN: Platform super – manage admins, approve dealers, billing, override budgets
 */
export const Role = {
  USER: 'USER',
  DEALER_USER: 'DEALER_USER',
  DEALER_ADMIN: 'DEALER_ADMIN',
  ADMIN: 'ADMIN',
  SUPERADMIN: 'SUPERADMIN',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

/** Roles that belong to the platform admin (not dealer) */
export const PLATFORM_ADMIN_ROLES: RoleType[] = [Role.ADMIN, Role.SUPERADMIN];

/** Roles that belong to dealer/agency accounts */
export const DEALER_ROLES: RoleType[] = [Role.DEALER_ADMIN, Role.DEALER_USER];

/** All valid role values */
export const ALL_ROLES: RoleType[] = [
  Role.USER,
  Role.DEALER_USER,
  Role.DEALER_ADMIN,
  Role.ADMIN,
  Role.SUPERADMIN,
];

export function isPlatformAdmin(role: string): boolean {
  return PLATFORM_ADMIN_ROLES.includes(role as RoleType);
}

export function isDealerRole(role: string): boolean {
  return DEALER_ROLES.includes(role as RoleType);
}

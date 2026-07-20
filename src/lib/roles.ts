export type Role = 'PENDING' | 'USER' | 'ADMIN' | 'SUPERADMIN'

/** SUPERADMIN is fixed/seeded once via scripts/bootstrap-superadmin.ts — never grantable through the app. */
export const ASSIGNABLE_ROLES: Role[] = ['PENDING', 'USER', 'ADMIN']

export function hasAppAccess(role: Role | undefined): boolean {
  return role === 'USER' || role === 'ADMIN' || role === 'SUPERADMIN'
}

export function isAdminRole(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'SUPERADMIN'
}

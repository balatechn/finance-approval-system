import { Role } from '@prisma/client';

export type UserRole = Role;

export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 100,
  MD: 90,
  DIRECTOR: 80,
  FINANCE_CONTROLLER: 70,
  FINANCE_TEAM: 60,
  EMPLOYEE: 10,
};

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  EMPLOYEE: [
    'request:create',
    'request:view:own',
    'request:edit:own:draft',
    'request:delete:own:draft',
    'request:respond:sendback',
  ],
  FINANCE_TEAM: [
    'request:view:all',
    'request:edit:financial',
    'approval:finance:vetting',
    'disbursement:process',
    'dashboard:finance',
    'reports:all',
  ],
  FINANCE_CONTROLLER: [
    'request:view:all',
    'approval:finance:controller',
    'dashboard:all',
    'reports:all',
  ],
  DIRECTOR: [
    'request:view:all',
    'approval:director',
    'dashboard:all',
    'reports:all',
  ],
  MD: [
    'request:view:all',
    'approval:md',
    'dashboard:all',
    'reports:all',
    'config:view',
  ],
  ADMIN: [
    'request:view:all',
    'request:edit:all',
    'approval:override',
    'user:manage',
    'config:manage',
    'reports:all',
    'system:manage',
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  
  if (permissions.includes(permission)) return true;
  
  const [category, action] = permission.split(':');
  if (permissions.includes(`${category}:*`)) return true;
  
  if (role === 'ADMIN') return true;
  
  return false;
}

export function canApproveLevel(role: Role, level: string): boolean {
  switch (level) {
    case 'FINANCE_VETTING':
      return role === 'FINANCE_TEAM' || role === 'ADMIN';
    case 'FINANCE_PLANNER':
      return role === 'FINANCE_CONTROLLER' || role === 'ADMIN';
    case 'FINANCE_CONTROLLER':
      return role === 'FINANCE_CONTROLLER' || role === 'ADMIN';
    case 'DIRECTOR':
      return role === 'DIRECTOR' || role === 'ADMIN';
    case 'MD':
      return role === 'MD' || role === 'ADMIN';
    case 'DISBURSEMENT':
      return role === 'FINANCE_TEAM' || role === 'ADMIN';
    default:
      return false;
  }
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    EMPLOYEE: 'Employee',
    FINANCE_TEAM: 'Finance Team',
    FINANCE_CONTROLLER: 'Finance Controller',
    DIRECTOR: 'Director',
    MD: 'Managing Director',
    ADMIN: 'Administrator',
  };
  return labels[role] || role;
}

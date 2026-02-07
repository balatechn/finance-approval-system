import { Role } from '@prisma/client';

export type UserRole = Role;

export const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 100,
  FINANCE_HEAD: 80,
  FINANCE_TEAM: 60,
  DEPARTMENT_HEAD: 50,
  MANAGER: 40,
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
  MANAGER: [
    'request:view:team',
    'approval:manager',
    'dashboard:team',
  ],
  DEPARTMENT_HEAD: [
    'request:view:department',
    'approval:hod',
    'dashboard:department',
    'reports:department',
  ],
  FINANCE_TEAM: [
    'request:view:all',
    'request:edit:financial',
    'approval:finance:vetting',
    'disbursement:process',
    'dashboard:finance',
    'reports:all',
  ],
  FINANCE_HEAD: [
    'request:view:all',
    'approval:finance:final',
    'disbursement:approve',
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
  
  // Check exact permission
  if (permissions.includes(permission)) return true;
  
  // Check wildcard permissions
  const [category, action] = permission.split(':');
  if (permissions.includes(`${category}:*`)) return true;
  
  // Admin has all permissions
  if (role === 'ADMIN') return true;
  
  return false;
}

export function canApproveLevel(role: Role, level: string): boolean {
  switch (level) {
    case 'MANAGER':
      return role === 'MANAGER' || role === 'ADMIN';
    case 'DEPARTMENT_HEAD':
      return role === 'DEPARTMENT_HEAD' || role === 'ADMIN';
    case 'FINANCE_VETTING':
      return role === 'FINANCE_TEAM' || role === 'FINANCE_HEAD' || role === 'ADMIN';
    case 'FINANCE_APPROVAL':
      return role === 'FINANCE_HEAD' || role === 'ADMIN';
    case 'DISBURSEMENT':
      return role === 'FINANCE_TEAM' || role === 'FINANCE_HEAD' || role === 'ADMIN';
    default:
      return false;
  }
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    EMPLOYEE: 'Employee',
    MANAGER: 'Manager',
    DEPARTMENT_HEAD: 'Department Head',
    FINANCE_TEAM: 'Finance Team',
    FINANCE_HEAD: 'Finance Head',
    ADMIN: 'Administrator',
  };
  return labels[role] || role;
}

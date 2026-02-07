import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';
import { Role } from '@prisma/client';
import { hasPermission, canApproveLevel } from './permissions';

export async function getSession() {
  return await getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireRole(roles: Role | Role[]) {
  const user = await requireAuth();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
  
  return user;
}

export async function requirePermission(permission: string) {
  const user = await requireAuth();
  
  if (!hasPermission(user.role, permission)) {
    throw new Error('Forbidden: Insufficient permissions');
  }
  
  return user;
}

export async function canApprove(level: string) {
  const user = await requireAuth();
  return canApproveLevel(user.role, level);
}

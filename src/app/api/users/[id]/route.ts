import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';
import { sendPasswordResetEmail, sendUserUpdatedEmail, sendUserDeactivatedEmail } from '@/lib/email/email-service';

export const dynamic = 'force-dynamic';

// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,

      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(targetUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, role, department, employeeId, isActive } = body;

    // Fetch current user data for change tracking
    const currentUserData = await prisma.user.findUnique({
      where: { id: params.id },
      select: { name: true, email: true, role: true, department: true, employeeId: true, isActive: true },
    });
    if (!currentUserData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const ROLE_LABELS: Record<string, string> = {
      EMPLOYEE: 'Employee', FINANCE_TEAM: 'Finance Team', FINANCE_CONTROLLER: 'Finance Controller',
      DIRECTOR: 'Director', MD: 'Managing Director', ADMIN: 'Administrator',
    };

    // Build update data
    const updateData: any = {};
    const passwordWasReset = !!password;
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department || null;
    if (employeeId !== undefined) updateData.employeeId = employeeId || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (password) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    // Check email uniqueness if changing
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), id: { not: params.id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        );
      }
    }

    // Check employeeId uniqueness if changing
    if (employeeId) {
      const existing = await prisma.user.findFirst({
        where: { employeeId, id: { not: params.id } },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A user with this employee ID already exists' },
          { status: 409 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employeeId: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Send email notifications
    try {
      if (passwordWasReset) {
        await sendPasswordResetEmail(
          updatedUser.email,
          updatedUser.name,
          password,
          user!.name || 'Admin'
        );
      }

      // Track non-password changes
      const changes: string[] = [];
      if (name !== undefined && name !== currentUserData.name) changes.push(`Name changed from "${currentUserData.name}" to "${name}"`);
      if (email !== undefined && email.toLowerCase() !== currentUserData.email) changes.push(`Email changed from "${currentUserData.email}" to "${email.toLowerCase()}"`);
      if (role !== undefined && role !== currentUserData.role) changes.push(`Role changed from "${ROLE_LABELS[currentUserData.role] || currentUserData.role}" to "${ROLE_LABELS[role] || role}"`);
      if (department !== undefined && department !== currentUserData.department) changes.push(`Department changed from "${currentUserData.department || 'None'}" to "${department || 'None'}"`);
      if (employeeId !== undefined && employeeId !== currentUserData.employeeId) changes.push(`Employee ID changed from "${currentUserData.employeeId || 'None'}" to "${employeeId || 'None'}"`);
      if (isActive !== undefined && isActive !== currentUserData.isActive) changes.push(`Account ${isActive ? 'activated' : 'deactivated'}`);

      if (changes.length > 0 && !passwordWasReset) {
        await sendUserUpdatedEmail(
          updatedUser.email,
          updatedUser.name,
          changes,
          user!.name || 'Admin'
        );
      } else if (changes.length > 0 && passwordWasReset) {
        // If password was reset AND other changes were made, send both
        await sendUserUpdatedEmail(
          updatedUser.email,
          updatedUser.name,
          changes,
          user!.name || 'Admin'
        );
      }
    } catch (emailError) {
      console.error('Error sending user update emails:', emailError);
    }

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Deactivate user (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Prevent self-deletion
    if (params.id === user.id) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      );
    }

    const deactivatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
      select: { name: true, email: true },
    });

    // Send deactivation email to user + admins
    try {
      await sendUserDeactivatedEmail(
        deactivatedUser.email,
        deactivatedUser.name,
        user!.name || 'Admin'
      );
    } catch (emailError) {
      console.error('Error sending deactivation email:', emailError);
    }

    return NextResponse.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate user' },
      { status: 500 }
    );
  }
}

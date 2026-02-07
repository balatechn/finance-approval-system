import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/permissions';

// GET /api/finance-requests/[id] - Get single finance request
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try lookup by referenceNumber first, then by id
    const identifier = params.id;
    const financeRequest = await prisma.financeRequest.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { referenceNumber: identifier },
          { id: identifier },
        ],
      },
      include: {
        requestor: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true,
            manager: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        attachments: {
          where: { isDeleted: false },
          orderBy: { uploadedAt: 'desc' }
        },
        approvalSteps: {
          include: {
            actions: {
              include: {
                actor: {
                  select: { id: true, name: true, email: true, role: true }
                }
              },
              orderBy: { createdAt: 'asc' }
            }
          },
          orderBy: { sequence: 'asc' }
        },
        slaLogs: {
          orderBy: { createdAt: 'desc' }
        },
        notifications: {
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check access permissions
    const canView = checkViewPermission(user, financeRequest);
    if (!canView) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Transform response to match frontend interface
    const transformedSteps = financeRequest.approvalSteps.map((step) => {
      const lastAction = step.actions?.[step.actions.length - 1];
      return {
        ...step,
        isOverdue: step.slaBreached,
        approverName: lastAction?.actor?.name || null,
        comments: lastAction?.comments || null,
      };
    });

    const response = {
      ...financeRequest,
      requester: financeRequest.requestor,
      approvalSteps: transformedSteps,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching finance request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finance request' },
      { status: 500 }
    );
  }
}

// PATCH /api/finance-requests/[id] - Update finance request
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identifier = params.id;
    const existingRequest = await prisma.financeRequest.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { referenceNumber: identifier },
          { id: identifier },
        ],
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check edit permissions
    const canEdit = checkEditPermission(user, existingRequest);
    if (!canEdit) {
      return NextResponse.json({ error: 'Cannot edit this request' }, { status: 403 });
    }

    const body = await request.json();

    // If submitting a draft
    if (body.status === 'SUBMITTED' && existingRequest.status === 'DRAFT') {
      const updatedRequest = await prisma.financeRequest.update({
        where: { id: existingRequest.id },
        data: {
          ...body,
          status: 'PENDING_FINANCE_VETTING',
          currentApprovalLevel: 'FINANCE_VETTING',
          submittedAt: new Date(),
        },
      });

      // Create approval steps
      await createApprovalStepsForRequest(updatedRequest.id, updatedRequest.paymentType, user.id);

      return NextResponse.json(updatedRequest);
    }

    // Regular update
    const updatedRequest = await prisma.financeRequest.update({
      where: { id: existingRequest.id },
      data: body,
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error('Error updating finance request:', error);
    return NextResponse.json(
      { error: 'Failed to update finance request' },
      { status: 500 }
    );
  }
}

// DELETE /api/finance-requests/[id] - Soft delete finance request
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deleteIdentifier = params.id;
    const existingDeleteRequest = await prisma.financeRequest.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { referenceNumber: deleteIdentifier },
          { id: deleteIdentifier },
        ],
      },
    });

    if (!existingDeleteRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only allow deletion of drafts by the requestor
    if (existingDeleteRequest.status !== 'DRAFT' || existingDeleteRequest.requestorId !== user.id) {
      return NextResponse.json(
        { error: 'Only draft requests can be deleted by the requestor' },
        { status: 403 }
      );
    }

    await prisma.financeRequest.update({
      where: { id: existingDeleteRequest.id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting finance request:', error);
    return NextResponse.json(
      { error: 'Failed to delete finance request' },
      { status: 500 }
    );
  }
}

// Helper functions
function checkViewPermission(user: any, request: any): boolean {
  if (request.requestorId === user.id) return true;

  switch (user.role) {
    case 'ADMIN':
    case 'MD':
    case 'DIRECTOR':
    case 'FINANCE_CONTROLLER':
    case 'FINANCE_TEAM':
      return true;
    default:
      return false;
  }
}

function checkEditPermission(user: any, request: any): boolean {
  if (request.status === 'DRAFT' && request.requestorId === user.id) {
    return true;
  }

  if (request.status === 'SENT_BACK' && request.requestorId === user.id) {
    return true;
  }

  if (
    request.status === 'PENDING_FINANCE_VETTING' &&
    user.role === 'FINANCE_TEAM'
  ) {
    return true;
  }

  if (user.role === 'ADMIN') return true;

  return false;
}

async function createApprovalStepsForRequest(
  financeRequestId: string,
  paymentType: string,
  requestorId: string
) {
  const slaHours: Record<string, number> = {
    FINANCE_VETTING: paymentType === 'CRITICAL' ? 24 : 72,
    FINANCE_CONTROLLER: 24,
    DIRECTOR: 24,
    MD: 24,
    DISBURSEMENT: 24,
  };

  const levels = [
    'FINANCE_VETTING',
    'FINANCE_CONTROLLER',
    'DIRECTOR',
    'MD',
    'DISBURSEMENT',
  ] as const;

  const roleMapping: Record<string, string> = {
    FINANCE_VETTING: 'FINANCE_TEAM',
    FINANCE_CONTROLLER: 'FINANCE_CONTROLLER',
    DIRECTOR: 'DIRECTOR',
    MD: 'MD',
    DISBURSEMENT: 'FINANCE_TEAM',
  };

  const now = new Date();

  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const isFirst = i === 0;

    await prisma.approvalStep.create({
      data: {
        financeRequestId,
        level,
        sequence: i + 1,
        assignedToRole: roleMapping[level] as any,
        status: 'PENDING',
        isActive: isFirst,
        slaHours: slaHours[level],
        slaDueAt: isFirst ? new Date(now.getTime() + slaHours[level] * 60 * 60 * 1000) : null,
        startedAt: isFirst ? now : null,
      },
    });

    if (isFirst) {
      await prisma.sLALog.create({
        data: {
          financeRequestId,
          level,
          slaHours: slaHours[level],
          slaDueAt: new Date(now.getTime() + slaHours[level] * 60 * 60 * 1000),
        },
      });
    }
  }
}

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { approvalActionSchema } from '@/lib/validations/finance-request';
import { canApproveLevel } from '@/lib/auth/permissions';
import { ApprovalLevel, RequestStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// POST /api/finance-requests/[id]/approve - Process approval action
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    body.financeRequestId = params.id;

    // Validate
    const validationResult = approvalActionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { action, comments } = validationResult.data;

    // Get the finance request with current approval step
    const financeRequest = await prisma.financeRequest.findUnique({
      where: { id: params.id, isDeleted: false },
      include: {
        approvalSteps: {
          where: { isActive: true },
          take: 1,
        },
        requestor: true,
      },
    });

    if (!financeRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    const currentStep = financeRequest.approvalSteps[0];
    if (!currentStep) {
      return NextResponse.json({ error: 'No active approval step' }, { status: 400 });
    }

    // Check if user can approve at this level
    if (!canApproveLevel(user.role, currentStep.level)) {
      return NextResponse.json(
        { error: 'You are not authorized to approve at this level' },
        { status: 403 }
      );
    }

    // Calculate SLA compliance
    const now = new Date();
    const responseTimeHours = currentStep.startedAt
      ? (now.getTime() - currentStep.startedAt.getTime()) / (1000 * 60 * 60)
      : 0;
    const slaCompliant = currentStep.slaDueAt ? now <= currentStep.slaDueAt : true;

    // Create approval action record
    await prisma.approvalAction_Record.create({
      data: {
        approvalStepId: currentStep.id,
        financeRequestId: params.id,
        actorId: user.id,
        action: action,
        comments: comments || null,
        slaCompliant,
        responseTimeHours: new Decimal(responseTimeHours.toFixed(2)),
      },
    });

    // Update current step
    await prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: {
        status: 'COMPLETED',
        isActive: false,
        completedAt: now,
        slaBreached: !slaCompliant,
      },
    });

    // Update SLA log if breached
    if (!slaCompliant) {
      await prisma.sLALog.updateMany({
        where: {
          financeRequestId: params.id,
          level: currentStep.level,
          isBreached: false,
        },
        data: {
          isBreached: true,
          breachedAt: currentStep.slaDueAt,
        },
      });
    }

    // Process based on action
    let newStatus: RequestStatus;
    let nextLevel: ApprovalLevel | null = null;

    if (action === 'APPROVED') {
      const result = await processApproval(params.id, currentStep.level, financeRequest.paymentType);
      newStatus = result.newStatus;
      nextLevel = result.nextLevel;
    } else if (action === 'REJECTED') {
      newStatus = 'REJECTED';
    } else {
      // SENT_BACK
      newStatus = 'SENT_BACK';
    }

    // Update finance request status
    await prisma.financeRequest.update({
      where: { id: params.id },
      data: {
        status: newStatus,
        currentApprovalLevel: nextLevel,
        completedAt: ['APPROVED', 'REJECTED', 'DISBURSED'].includes(newStatus) ? now : null,
      },
    });

    // Create notification
    await createApprovalNotification(
      financeRequest,
      action,
      user.name,
      comments || ''
    );

    return NextResponse.json({
      message: `Request ${action.toLowerCase()} successfully`,
      status: newStatus,
    });
  } catch (error) {
    console.error('Error processing approval:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}

// Helper function to process approval and move to next level
async function processApproval(
  requestId: string,
  currentLevel: ApprovalLevel,
  paymentType: string
): Promise<{ newStatus: RequestStatus; nextLevel: ApprovalLevel | null }> {
  const levelSequence: ApprovalLevel[] = [
    'MANAGER',
    'DEPARTMENT_HEAD',
    'FINANCE_VETTING',
    'FINANCE_APPROVAL',
    'DISBURSEMENT',
  ];

  const statusMapping: Record<ApprovalLevel, RequestStatus> = {
    MANAGER: 'PENDING_HOD',
    DEPARTMENT_HEAD: 'PENDING_FINANCE_VETTING',
    FINANCE_VETTING: 'PENDING_FINANCE_APPROVAL',
    FINANCE_APPROVAL: 'APPROVED',
    DISBURSEMENT: 'DISBURSED',
  };

  const currentIndex = levelSequence.indexOf(currentLevel);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= levelSequence.length || currentLevel === 'FINANCE_APPROVAL') {
    // Final approval reached
    return { newStatus: statusMapping[currentLevel], nextLevel: null };
  }

  const nextLevel = levelSequence[nextIndex];
  const newStatus = statusMapping[currentLevel];

  // Activate next approval step
  const slaHours = {
    MANAGER: 24,
    DEPARTMENT_HEAD: 24,
    FINANCE_VETTING: paymentType === 'CRITICAL' ? 24 : 72,
    FINANCE_APPROVAL: 24,
    DISBURSEMENT: 24,
  };

  const now = new Date();
  const slaDueAt = new Date(now.getTime() + slaHours[nextLevel] * 60 * 60 * 1000);

  await prisma.approvalStep.updateMany({
    where: {
      financeRequestId: requestId,
      level: nextLevel,
    },
    data: {
      isActive: true,
      startedAt: now,
      slaDueAt: slaDueAt,
    },
  });

  // Create SLA log for next step
  await prisma.sLALog.create({
    data: {
      financeRequestId: requestId,
      level: nextLevel,
      slaHours: slaHours[nextLevel],
      slaDueAt: slaDueAt,
    },
  });

  return { newStatus, nextLevel };
}

// Helper function to create approval notification
async function createApprovalNotification(
  request: any,
  action: string,
  actorName: string,
  comments: string
) {
  const titles: Record<string, string> = {
    APPROVED: 'Request Approved',
    REJECTED: 'Request Rejected',
    SENT_BACK: 'Request Sent Back',
  };

  const messages: Record<string, string> = {
    APPROVED: `Your request ${request.referenceNumber} has been approved by ${actorName}.`,
    REJECTED: `Your request ${request.referenceNumber} has been rejected by ${actorName}. Reason: ${comments}`,
    SENT_BACK: `Your request ${request.referenceNumber} has been sent back by ${actorName}. Comments: ${comments}`,
  };

  await prisma.notification.create({
    data: {
      userId: request.requestorId,
      financeRequestId: request.id,
      type: action,
      title: titles[action],
      message: messages[action],
    },
  });
}
